"""
Photo upload service for VanlifeVibes.

Handles validation, upload, and deletion of profile photos (avatar, cover, gallery).
Enforces business rules: avatar/cover uniqueness, gallery limit of 6,
file size/type validation, and Profile URL synchronization.
"""
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
MAX_GALLERY_PHOTOS = 6


def validate_photo_file(file):
    """
    Validate an uploaded photo file.

    Checks:
    - File size does not exceed 10MB
    - Content type is JPEG, PNG, or WebP
    - File is a valid image (verified via Pillow)

    Args:
        file: An uploaded file object (e.g., InMemoryUploadedFile or SimpleUploadedFile).

    Raises:
        ValidationError: If any validation check fails.
    """
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
    """
    Handle uploading a profile photo.

    For avatar/cover types: deletes any existing photo of that type (enforcing uniqueness),
    creates the new ProfilePhoto, and updates Profile.avatar_url or cover_url.

    For gallery type: enforces a maximum of 6 gallery photos per profile.

    Args:
        profile: The Profile instance to attach the photo to.
        image_file: The validated uploaded image file.
        photo_type: One of 'avatar', 'cover', or 'gallery'.
        display_order: Optional display order (PositiveIntegerField). Defaults to 0.

    Returns:
        The created ProfilePhoto instance.

    Raises:
        ValidationError: If gallery limit would be exceeded.
    """
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
                "Maximum of 6 gallery photos allowed. Delete an existing photo first."
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
    """
    Handle deleting a profile photo.

    Deletes the ProfilePhoto record and its associated file from storage.
    If the photo is an avatar or cover, clears the corresponding URL field on the Profile.

    Args:
        profile: The Profile instance that owns the photo.
        photo: The ProfilePhoto instance to delete.
    """
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
