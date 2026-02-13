"""Photo upload service for profile photos (avatar, cover, gallery)."""
import logging
from io import BytesIO

from PIL import Image
from rest_framework.exceptions import ValidationError

from core.models import ProfilePhoto

logger = logging.getLogger(__name__)

# Constants
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_CONTENT_TYPES = {
    'image/jpeg',
    'image/png',
    'image/webp',
}
MAX_GALLERY_PHOTOS = 5


def validate_photo_file(file):
    """Validate file size, content type, and image integrity."""
    # Check file size
    if file.size > MAX_FILE_SIZE:
        raise ValidationError("File size exceeds the 10MB limit.")

    # Check content type
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise ValidationError(
            "Unsupported file type. Accepted formats: JPEG, PNG, WebP."
        )

    # Verify the file is a valid image using Pillow
    try:
        file.seek(0)
        image_data = file.read()
        image = Image.open(BytesIO(image_data))
        image.verify()
        file.seek(0)
    except Exception:
        raise ValidationError("The uploaded file is not a valid image.")


def handle_photo_upload(profile, image_file, photo_type, display_order=None):
    """Upload a profile photo, enforcing uniqueness for avatar/cover and gallery limit."""
    if photo_type in ('avatar', 'cover'):
        # Delete any existing photo of this type for the profile
        existing_photos = ProfilePhoto.objects.filter(
            profile=profile,
            photo_type=photo_type,
        )
        for existing in existing_photos:
            # Delete the file from storage
            if existing.image:
                existing.image.delete(save=False)
            existing.delete()

    elif photo_type == 'gallery':
        # Enforce gallery limit
        gallery_count = ProfilePhoto.objects.filter(
            profile=profile,
            photo_type='gallery',
        ).count()
        if gallery_count >= MAX_GALLERY_PHOTOS:
            raise ValidationError(
                "Maximum of 5 gallery photos allowed. Delete an existing photo first."
            )

    # Create the new ProfilePhoto
    photo = ProfilePhoto.objects.create(
        profile=profile,
        photo_type=photo_type,
        image=image_file,
        display_order=display_order if display_order is not None else 0,
    )

    # Update Profile avatar_url / cover_url for avatar and cover types
    if photo_type == 'avatar':
        profile.avatar_url = photo.image.url
        profile.save(update_fields=['avatar_url'])
    elif photo_type == 'cover':
        profile.cover_url = photo.image.url
        profile.save(update_fields=['cover_url'])

    return photo


def handle_photo_delete(profile, photo):
    """Delete a profile photo and clear avatar/cover URL if applicable."""
    photo_type = photo.photo_type

    # Delete the image file from storage
    if photo.image:
        photo.image.delete(save=False)

    # Delete the ProfilePhoto record
    photo.delete()

    # Clear Profile URL fields if avatar or cover was deleted
    if photo_type == 'avatar':
        profile.avatar_url = None
        profile.save(update_fields=['avatar_url'])
    elif photo_type == 'cover':
        profile.cover_url = None
        profile.save(update_fields=['cover_url'])
