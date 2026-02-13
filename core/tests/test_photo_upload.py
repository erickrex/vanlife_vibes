"""
Property-based tests for the photo upload feature.

Uses Hypothesis to verify correctness properties of the photo upload service.
"""
import io
import tempfile

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from hypothesis import given, settings
from hypothesis import strategies as st
from PIL import Image

from core.models import ProfilePhoto, UserAccount


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create_test_image(fmt="JPEG", size=(10, 10)):
    """Return a SimpleUploadedFile containing a valid image of the given format."""
    content_types = {"JPEG": "image/jpeg", "PNG": "image/png", "WEBP": "image/webp"}
    extensions = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}

    buf = io.BytesIO()
    img = Image.new("RGB", size, color="red")
    img.save(buf, format=fmt)
    buf.seek(0)

    return SimpleUploadedFile(
        name=f"test.{extensions[fmt]}",
        content=buf.read(),
        content_type=content_types[fmt],
    )


def _create_user_with_profile(username, email):
    """Create a UserAccount (profile is auto-created via signal)."""
    user = UserAccount.objects.create_user(
        username=username,
        email=email,
        password="testpass123",
    )
    return user, user.profile


# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------

# Strategy that generates a non-empty list of photo_type choices (avatar or cover)
avatar_cover_sequence = st.lists(
    st.sampled_from(["avatar", "cover"]),
    min_size=1,
    max_size=20,
)


# ---------------------------------------------------------------------------
# Property 1: Avatar/cover uniqueness invariant
# Feature: photo-upload, Property 1: Avatar/cover uniqueness invariant
# ---------------------------------------------------------------------------

_tmp_media = tempfile.mkdtemp()


@pytest.mark.django_db(transaction=True)
@override_settings(MEDIA_ROOT=_tmp_media)
@given(upload_sequence=avatar_cover_sequence)
@settings(max_examples=100)
def test_avatar_cover_uniqueness_invariant(upload_sequence):
    """
    For any profile and any sequence of avatar/cover photo uploads, the
    profile SHALL have at most one avatar photo and at most one cover photo
    at any point in time.  After uploading a new avatar, querying the
    profile's photos filtered by photo_type='avatar' should return exactly
    one result (and likewise for cover).
    """
    # Import here so Django is fully initialised inside the test function
    from core.services.photo_upload import handle_photo_upload

    # Fresh user for every example so sequences don't interfere
    import uuid
    unique = uuid.uuid4().hex[:8]
    _user, profile = _create_user_with_profile(
        username=f"pbt_{unique}",
        email=f"pbt_{unique}@test.com",
    )

    # Track which types we have uploaded at least once
    uploaded_types = set()

    for photo_type in upload_sequence:
        image_file = _create_test_image()
        handle_photo_upload(profile, image_file, photo_type)
        uploaded_types.add(photo_type)

        # --- Invariant check after every upload ---
        avatar_count = ProfilePhoto.objects.filter(
            profile=profile, photo_type="avatar"
        ).count()
        cover_count = ProfilePhoto.objects.filter(
            profile=profile, photo_type="cover"
        ).count()

        assert avatar_count <= 1, (
            f"Expected at most 1 avatar photo, found {avatar_count} "
            f"after uploading '{photo_type}'"
        )
        assert cover_count <= 1, (
            f"Expected at most 1 cover photo, found {cover_count} "
            f"after uploading '{photo_type}'"
        )

        # If we just uploaded this type, there should be exactly 1
        if photo_type in ("avatar", "cover"):
            exact_count = ProfilePhoto.objects.filter(
                profile=profile, photo_type=photo_type
            ).count()
            assert exact_count == 1, (
                f"Expected exactly 1 {photo_type} photo after uploading "
                f"{photo_type}, found {exact_count}"
            )


# ---------------------------------------------------------------------------
# Strategies for Property 2
# ---------------------------------------------------------------------------

# Strategy that generates a number of gallery upload attempts (1 to 15)
gallery_upload_attempts = st.integers(min_value=1, max_value=15)


# ---------------------------------------------------------------------------
# Property 2: Gallery photo count invariant
# Feature: photo-upload, Property 2: Gallery photo count invariant
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
@override_settings(MEDIA_ROOT=_tmp_media)
@given(num_attempts=gallery_upload_attempts)
@settings(max_examples=100, deadline=None)
def test_gallery_photo_count_invariant(num_attempts):
    """
    For any profile, the number of gallery photos SHALL never exceed 5.
    After any sequence of gallery uploads (including rejected ones),
    ProfilePhoto.objects.filter(profile=p, photo_type='gallery').count() <= 5.
    """
    from rest_framework.exceptions import ValidationError as DRFValidationError

    from core.services.photo_upload import handle_photo_upload

    # Fresh user for every example so sequences don't interfere
    import uuid
    unique = uuid.uuid4().hex[:8]
    _user, profile = _create_user_with_profile(
        username=f"gal_{unique}",
        email=f"gal_{unique}@test.com",
    )

    for i in range(num_attempts):
        image_file = _create_test_image()
        try:
            handle_photo_upload(profile, image_file, "gallery")
        except DRFValidationError:
            # Uploads beyond the limit are expected to be rejected
            pass

        # --- Invariant check after every upload attempt ---
        gallery_count = ProfilePhoto.objects.filter(
            profile=profile, photo_type="gallery"
        ).count()

        assert gallery_count <= 5, (
            f"Gallery photo count invariant violated: found {gallery_count} "
            f"gallery photos after attempt {i + 1} of {num_attempts}"
        )

    # Final invariant check
    final_count = ProfilePhoto.objects.filter(
        profile=profile, photo_type="gallery"
    ).count()
    assert final_count <= 5, (
        f"Gallery photo count invariant violated at end: found {final_count} "
        f"gallery photos after {num_attempts} upload attempts"
    )


# ---------------------------------------------------------------------------
# Strategies for Property 3
# ---------------------------------------------------------------------------

# File sizes above the 10MB limit (10MB + 1 byte up to ~20MB)
oversized_file_sizes = st.integers(
    min_value=10 * 1024 * 1024 + 1,
    max_value=20 * 1024 * 1024,
)

# File sizes at or below the 10MB limit (1 byte up to exactly 10MB)
valid_file_sizes = st.integers(
    min_value=1,
    max_value=10 * 1024 * 1024,
)


# ---------------------------------------------------------------------------
# Property 3: File size validation
# Feature: photo-upload, Property 3: File size validation
# ---------------------------------------------------------------------------


@given(file_size=oversized_file_sizes)
@settings(max_examples=100)
def test_file_size_validation_rejects_oversized(file_size):
    """
    For any file with size greater than 10MB, the validate_photo_file function
    SHALL raise a validation error with the message about the size limit.
    """
    from unittest.mock import PropertyMock, patch

    from rest_framework.exceptions import ValidationError as DRFValidationError

    from core.services.photo_upload import validate_photo_file

    # Create a small valid JPEG image
    image_file = _create_test_image("JPEG", size=(10, 10))

    # Override the size property to simulate a large file
    with patch.object(type(image_file), "size", new_callable=PropertyMock, return_value=file_size):
        with pytest.raises(DRFValidationError, match="File size exceeds the 10MB limit"):
            validate_photo_file(image_file)


@given(file_size=valid_file_sizes)
@settings(max_examples=100)
def test_file_size_validation_accepts_valid_sizes(file_size):
    """
    For any file with size less than or equal to 10MB (and valid content type),
    the validate_photo_file function SHALL not raise a size-related error.
    """
    from unittest.mock import PropertyMock, patch

    from core.services.photo_upload import validate_photo_file

    # Create a small valid JPEG image
    image_file = _create_test_image("JPEG", size=(10, 10))

    # Override the size property to simulate the generated file size
    with patch.object(type(image_file), "size", new_callable=PropertyMock, return_value=file_size):
        # Should not raise any exception — the file has valid content type and valid size
        validate_photo_file(image_file)


# ---------------------------------------------------------------------------
# Strategies for Property 4
# ---------------------------------------------------------------------------

# Valid content types that should be accepted
valid_content_types = st.sampled_from(["image/jpeg", "image/png", "image/webp"])

# Map content types to Pillow format names for creating valid images
_content_type_to_format = {
    "image/jpeg": "JPEG",
    "image/png": "PNG",
    "image/webp": "WEBP",
}

# Invalid content types that should be rejected
invalid_content_types = st.sampled_from([
    "image/gif",
    "image/bmp",
    "image/tiff",
    "image/svg+xml",
    "application/pdf",
    "application/octet-stream",
    "text/plain",
    "text/html",
    "video/mp4",
    "audio/mpeg",
    "application/json",
    "image/x-icon",
    "application/zip",
])


# ---------------------------------------------------------------------------
# Property 4: Content type validation
# Feature: photo-upload, Property 4: Content type validation
# ---------------------------------------------------------------------------


@given(content_type=valid_content_types)
@settings(max_examples=100)
def test_content_type_validation_accepts_valid_types(content_type):
    """
    For any file with a content type in {image/jpeg, image/png, image/webp},
    the validate_photo_file function SHALL accept the file without raising
    a validation error.
    """
    from core.services.photo_upload import validate_photo_file

    # Create a valid image with the matching format
    fmt = _content_type_to_format[content_type]
    image_file = _create_test_image(fmt=fmt)
    # Override content_type to match the generated value
    image_file.content_type = content_type

    # Should not raise any exception
    validate_photo_file(image_file)


@given(content_type=invalid_content_types)
@settings(max_examples=100)
def test_content_type_validation_rejects_invalid_types(content_type):
    """
    For any file with a content type NOT in {image/jpeg, image/png, image/webp},
    the validate_photo_file function SHALL raise a ValidationError with a message
    about unsupported file types.
    """
    from rest_framework.exceptions import ValidationError as DRFValidationError

    from core.services.photo_upload import validate_photo_file

    # Create a valid JPEG image but set an invalid content type
    image_file = _create_test_image("JPEG", size=(10, 10))
    image_file.content_type = content_type

    with pytest.raises(DRFValidationError, match="Unsupported file type"):
        validate_photo_file(image_file)


# ---------------------------------------------------------------------------
# Strategies for Property 5
# ---------------------------------------------------------------------------

# Strategy for valid photo types
photo_type_strategy = st.sampled_from(["avatar", "cover", "gallery"])

# Strategy for valid image formats
image_format_strategy = st.sampled_from(["JPEG", "PNG", "WEBP"])


# ---------------------------------------------------------------------------
# Property 5: Upload creates retrievable record
# Feature: photo-upload, Property 5: Upload creates retrievable record
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
@override_settings(MEDIA_ROOT=_tmp_media)
@given(
    photo_type=photo_type_strategy,
    image_format=image_format_strategy,
)
@settings(max_examples=100, deadline=None)
def test_upload_creates_retrievable_record(photo_type, image_format):
    """
    For any valid image file and valid photo_type, POSTing to the upload
    endpoint SHALL create a ProfilePhoto that is subsequently retrievable
    via the GET list endpoint, with matching photo_type and a non-empty
    image URL.
    """
    from rest_framework.authtoken.models import Token
    from rest_framework.test import APIClient

    # Fresh user for every example so uploads don't interfere
    import uuid
    unique = uuid.uuid4().hex[:8]
    user, profile = _create_user_with_profile(
        username=f"ret_{unique}",
        email=f"ret_{unique}@test.com",
    )

    # Authenticate
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    # 1. Create a valid image and POST to the upload endpoint
    image_file = _create_test_image(fmt=image_format)
    response = client.post(
        "/api/v1/profiles/me/photos/",
        {"image": image_file, "photo_type": photo_type},
        format="multipart",
    )

    # 2. Assert 201 response with matching photo_type and non-empty image URL
    assert response.status_code == 201, (
        f"Expected 201 Created, got {response.status_code}: {response.data}"
    )
    assert response.data["status"] == "success"
    upload_data = response.data["data"]
    assert upload_data["photo_type"] == photo_type, (
        f"Expected photo_type '{photo_type}', got '{upload_data['photo_type']}'"
    )
    assert upload_data["image"], (
        "Expected non-empty image URL in upload response"
    )

    # 3. GET the list endpoint
    list_response = client.get("/api/v1/profiles/me/photos/")
    assert list_response.status_code == 200, (
        f"Expected 200 OK for list, got {list_response.status_code}"
    )
    assert list_response.data["status"] == "success"

    # 4. Assert the uploaded photo appears in the list with matching
    #    photo_type and non-empty image URL
    photos = list_response.data["data"]
    uploaded_id = upload_data["id"]
    matching = [p for p in photos if str(p["id"]) == str(uploaded_id)]

    assert len(matching) == 1, (
        f"Expected uploaded photo {uploaded_id} to appear exactly once in "
        f"list, found {len(matching)} matches in {[p['id'] for p in photos]}"
    )

    retrieved = matching[0]
    assert retrieved["photo_type"] == photo_type, (
        f"Expected photo_type '{photo_type}' in list, got '{retrieved['photo_type']}'"
    )
    assert retrieved["image"], (
        "Expected non-empty image URL in list response"
    )


# ---------------------------------------------------------------------------
# Strategies for Property 6
# ---------------------------------------------------------------------------

# Strategy that generates a list of distinct display_order values
distinct_display_orders = st.lists(
    st.integers(min_value=0, max_value=100),
    min_size=2,
    max_size=5,
    unique=True,
)


# ---------------------------------------------------------------------------
# Property 6: Photo list ordering
# Feature: photo-upload, Property 6: Photo list ordering
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
@override_settings(MEDIA_ROOT=_tmp_media)
@given(display_orders=distinct_display_orders)
@settings(max_examples=100, deadline=None)
def test_photo_list_ordering(display_orders):
    """
    For any profile with multiple photos having distinct display_order values,
    the GET list endpoint SHALL return photos sorted by display_order in
    ascending order.
    """
    from rest_framework.authtoken.models import Token
    from rest_framework.test import APIClient

    from core.services.photo_upload import handle_photo_upload

    # Fresh user for every example so uploads don't interfere
    import uuid
    unique = uuid.uuid4().hex[:8]
    user, profile = _create_user_with_profile(
        username=f"ord_{unique}",
        email=f"ord_{unique}@test.com",
    )

    # Create gallery photos via the service, then set distinct display_order values
    created_photos = []
    for order_val in display_orders:
        image_file = _create_test_image()
        photo = handle_photo_upload(profile, image_file, "gallery")
        photo.display_order = order_val
        photo.save()
        created_photos.append(photo)

    # Authenticate and GET the list endpoint
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    list_response = client.get("/api/v1/profiles/me/photos/")
    assert list_response.status_code == 200, (
        f"Expected 200 OK, got {list_response.status_code}: {list_response.data}"
    )
    assert list_response.data["status"] == "success"

    photos = list_response.data["data"]

    # Extract display_order values from the response
    returned_orders = [p["display_order"] for p in photos]

    # Assert the returned photos are sorted by display_order ascending
    assert returned_orders == sorted(returned_orders), (
        f"Photos not sorted by display_order ascending. "
        f"Got order: {returned_orders}, expected: {sorted(returned_orders)}"
    )


# ---------------------------------------------------------------------------
# Strategies for Property 7
# ---------------------------------------------------------------------------

# Strategy for photo types to delete
delete_photo_type_strategy = st.sampled_from(["avatar", "cover", "gallery"])

# Strategy for number of extra gallery photos to keep alongside the deleted one
extra_gallery_count = st.integers(min_value=0, max_value=4)


# ---------------------------------------------------------------------------
# Property 7: Delete removes photo
# Feature: photo-upload, Property 7: Delete removes photo
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
@override_settings(MEDIA_ROOT=_tmp_media)
@given(
    photo_type=delete_photo_type_strategy,
    num_extra=extra_gallery_count,
)
@settings(max_examples=100, deadline=None)
def test_delete_removes_photo(photo_type, num_extra):
    """
    For any ProfilePhoto belonging to the authenticated user, sending a
    DELETE request SHALL result in that photo no longer appearing in the
    GET list response.
    """
    import uuid

    from rest_framework.authtoken.models import Token
    from rest_framework.test import APIClient

    # Fresh user for every example
    unique = uuid.uuid4().hex[:8]
    user, profile = _create_user_with_profile(
        username=f"del_{unique}",
        email=f"del_{unique}@test.com",
    )

    # Authenticate
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    # 1. Upload the photo we intend to delete
    image_file = _create_test_image()
    upload_response = client.post(
        "/api/v1/profiles/me/photos/",
        {"image": image_file, "photo_type": photo_type},
        format="multipart",
    )
    assert upload_response.status_code == 201, (
        f"Expected 201 Created, got {upload_response.status_code}: "
        f"{upload_response.data}"
    )
    target_photo_id = upload_response.data["data"]["id"]

    # 2. Upload extra gallery photos so the list isn't empty after deletion
    extra_ids = []
    for _ in range(num_extra):
        extra_image = _create_test_image()
        extra_resp = client.post(
            "/api/v1/profiles/me/photos/",
            {"image": extra_image, "photo_type": "gallery"},
            format="multipart",
        )
        assert extra_resp.status_code == 201
        extra_ids.append(extra_resp.data["data"]["id"])

    # 3. DELETE the target photo
    delete_response = client.delete(
        f"/api/v1/profiles/me/photos/{target_photo_id}/",
    )
    assert delete_response.status_code == 200, (
        f"Expected 200 OK for delete, got {delete_response.status_code}: "
        f"{delete_response.data}"
    )
    assert delete_response.data["status"] == "success"

    # 4. GET the list endpoint
    list_response = client.get("/api/v1/profiles/me/photos/")
    assert list_response.status_code == 200, (
        f"Expected 200 OK for list, got {list_response.status_code}"
    )
    assert list_response.data["status"] == "success"

    # 5. Assert the deleted photo does NOT appear in the list
    photos = list_response.data["data"]
    photo_ids = [str(p["id"]) for p in photos]

    assert str(target_photo_id) not in photo_ids, (
        f"Deleted photo {target_photo_id} still appears in the list response. "
        f"Photo IDs in list: {photo_ids}"
    )

    # 6. Assert extra photos are still present (deletion was targeted)
    for extra_id in extra_ids:
        assert str(extra_id) in photo_ids, (
            f"Extra photo {extra_id} should still be in the list after "
            f"deleting {target_photo_id}, but it's missing. "
            f"Photo IDs in list: {photo_ids}"
        )


# ---------------------------------------------------------------------------
# Strategies for Property 8
# ---------------------------------------------------------------------------

# Strategy for non-negative display_order values
display_order_values = st.integers(min_value=0, max_value=1000)


# ---------------------------------------------------------------------------
# Property 8: Patch updates display order
# Feature: photo-upload, Property 8: Patch updates display order
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
@override_settings(MEDIA_ROOT=_tmp_media)
@given(new_display_order=display_order_values)
@settings(max_examples=100, deadline=None)
def test_patch_updates_display_order(new_display_order):
    """
    For any ProfilePhoto and any non-negative integer value, PATCHing with
    that display_order SHALL result in the photo's display_order being
    updated to the new value when subsequently retrieved.
    """
    import uuid

    from rest_framework.authtoken.models import Token
    from rest_framework.test import APIClient

    # Fresh user for every example
    unique = uuid.uuid4().hex[:8]
    user, profile = _create_user_with_profile(
        username=f"patch_{unique}",
        email=f"patch_{unique}@test.com",
    )

    # Authenticate
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    # 1. Upload a gallery photo via POST
    image_file = _create_test_image()
    upload_response = client.post(
        "/api/v1/profiles/me/photos/",
        {"image": image_file, "photo_type": "gallery"},
        format="multipart",
    )
    assert upload_response.status_code == 201, (
        f"Expected 201 Created, got {upload_response.status_code}: "
        f"{upload_response.data}"
    )
    photo_id = upload_response.data["data"]["id"]

    # 2. PATCH the photo with the generated display_order
    patch_response = client.patch(
        f"/api/v1/profiles/me/photos/{photo_id}/update/",
        {"display_order": new_display_order},
        format="json",
    )
    assert patch_response.status_code == 200, (
        f"Expected 200 OK for PATCH, got {patch_response.status_code}: "
        f"{patch_response.data}"
    )
    assert patch_response.data["status"] == "success"

    # 3. Assert the PATCH response contains the updated display_order
    patch_data = patch_response.data["data"]
    assert patch_data["display_order"] == new_display_order, (
        f"PATCH response display_order mismatch: expected {new_display_order}, "
        f"got {patch_data['display_order']}"
    )

    # 4. GET the list endpoint and verify the photo has the updated display_order
    list_response = client.get("/api/v1/profiles/me/photos/")
    assert list_response.status_code == 200, (
        f"Expected 200 OK for list, got {list_response.status_code}"
    )
    assert list_response.data["status"] == "success"

    photos = list_response.data["data"]
    matching = [p for p in photos if str(p["id"]) == str(photo_id)]

    assert len(matching) == 1, (
        f"Expected photo {photo_id} to appear exactly once in list, "
        f"found {len(matching)}"
    )

    retrieved = matching[0]
    assert retrieved["display_order"] == new_display_order, (
        f"GET list display_order mismatch: expected {new_display_order}, "
        f"got {retrieved['display_order']}"
    )


# ---------------------------------------------------------------------------
# Strategies for Property 9
# ---------------------------------------------------------------------------

# Strategy for the action type: delete or patch
cross_user_action_strategy = st.sampled_from(["delete", "patch"])


# ---------------------------------------------------------------------------
# Property 9: Cross-user photo isolation
# Feature: photo-upload, Property 9: Cross-user photo isolation
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
@override_settings(MEDIA_ROOT=_tmp_media)
@given(action_type=cross_user_action_strategy)
@settings(max_examples=100, deadline=None)
def test_cross_user_photo_isolation(action_type):
    """
    For any two distinct users A and B, user A SHALL not be able to delete
    or update photos belonging to user B. Such attempts SHALL return a 403
    status code and leave user B's photos unchanged.
    """
    import uuid

    from rest_framework.authtoken.models import Token
    from rest_framework.test import APIClient

    # Fresh users for every example
    unique = uuid.uuid4().hex[:8]
    user_a, _profile_a = _create_user_with_profile(
        username=f"iso_a_{unique}",
        email=f"iso_a_{unique}@test.com",
    )
    user_b, _profile_b = _create_user_with_profile(
        username=f"iso_b_{unique}",
        email=f"iso_b_{unique}@test.com",
    )

    # Authenticate user B and upload a photo
    token_b, _ = Token.objects.get_or_create(user=user_b)
    client_b = APIClient()
    client_b.credentials(HTTP_AUTHORIZATION=f"Token {token_b.key}")

    image_file = _create_test_image()
    upload_response = client_b.post(
        "/api/v1/profiles/me/photos/",
        {"image": image_file, "photo_type": "gallery"},
        format="multipart",
    )
    assert upload_response.status_code == 201, (
        f"Expected 201 Created for user B upload, got "
        f"{upload_response.status_code}: {upload_response.data}"
    )
    photo_b_id = upload_response.data["data"]["id"]
    photo_b_original_order = upload_response.data["data"]["display_order"]

    # Authenticate user A
    token_a, _ = Token.objects.get_or_create(user=user_a)
    client_a = APIClient()
    client_a.credentials(HTTP_AUTHORIZATION=f"Token {token_a.key}")

    # User A attempts to delete or patch user B's photo
    if action_type == "delete":
        response = client_a.delete(
            f"/api/v1/profiles/me/photos/{photo_b_id}/",
        )
    else:  # patch
        response = client_a.patch(
            f"/api/v1/profiles/me/photos/{photo_b_id}/update/",
            {"display_order": 999},
            format="json",
        )

    # Assert 403 Forbidden
    assert response.status_code == 403, (
        f"Expected 403 Forbidden when user A attempts to {action_type} "
        f"user B's photo, got {response.status_code}: {response.data}"
    )

    # Verify user B's photo is unchanged — still exists with original data
    list_response_b = client_b.get("/api/v1/profiles/me/photos/")
    assert list_response_b.status_code == 200, (
        f"Expected 200 OK for user B list, got {list_response_b.status_code}"
    )
    assert list_response_b.data["status"] == "success"

    photos_b = list_response_b.data["data"]
    matching = [p for p in photos_b if str(p["id"]) == str(photo_b_id)]

    assert len(matching) == 1, (
        f"User B's photo {photo_b_id} should still exist after user A's "
        f"{action_type} attempt, but found {len(matching)} matches in "
        f"{[p['id'] for p in photos_b]}"
    )

    # Verify the photo data is unchanged
    retrieved = matching[0]
    assert retrieved["photo_type"] == "gallery", (
        f"User B's photo type should still be 'gallery', "
        f"got '{retrieved['photo_type']}'"
    )
    assert retrieved["display_order"] == photo_b_original_order, (
        f"User B's photo display_order should still be "
        f"{photo_b_original_order}, got {retrieved['display_order']}"
    )


# ---------------------------------------------------------------------------
# Strategies for Property 10
# ---------------------------------------------------------------------------

# Strategy for avatar or cover photo type
avatar_cover_type_strategy = st.sampled_from(["avatar", "cover"])


# ---------------------------------------------------------------------------
# Property 10: Avatar/cover URL sync on upload
# Feature: photo-upload, Property 10: Avatar/cover URL sync on upload
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
@override_settings(MEDIA_ROOT=_tmp_media)
@given(photo_type=avatar_cover_type_strategy)
@settings(max_examples=100, deadline=None)
def test_avatar_cover_url_sync_on_upload(photo_type):
    """
    For any profile, after uploading an avatar photo, Profile.avatar_url
    SHALL equal the uploaded photo's image URL. After uploading a cover
    photo, Profile.cover_url SHALL equal the uploaded photo's image URL.
    """
    import uuid

    from rest_framework.authtoken.models import Token
    from rest_framework.test import APIClient

    from core.models import Profile

    # Fresh user for every example
    unique = uuid.uuid4().hex[:8]
    user, profile = _create_user_with_profile(
        username=f"sync_{unique}",
        email=f"sync_{unique}@test.com",
    )

    # Authenticate
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    # Upload a photo with the generated photo_type via POST
    image_file = _create_test_image()
    response = client.post(
        "/api/v1/profiles/me/photos/",
        {"image": image_file, "photo_type": photo_type},
        format="multipart",
    )

    assert response.status_code == 201, (
        f"Expected 201 Created, got {response.status_code}: {response.data}"
    )
    assert response.data["status"] == "success"

    # Get the uploaded photo's image URL from the response
    uploaded_image_url = response.data["data"]["image"]
    assert uploaded_image_url, "Expected non-empty image URL in upload response"

    # Refresh the profile from the database
    profile.refresh_from_db()

    # Check that the correct profile URL field matches the uploaded photo's URL
    if photo_type == "avatar":
        profile_url = profile.avatar_url
        field_name = "avatar_url"
    else:
        profile_url = profile.cover_url
        field_name = "cover_url"

    assert profile_url is not None, (
        f"Profile.{field_name} should not be None after uploading a "
        f"{photo_type} photo"
    )

    # The API response may return an absolute URL (e.g., http://testserver/media/...)
    # while the model stores a relative path (e.g., /media/...).
    # Check that the profile URL is contained within the uploaded image URL
    # or vice versa, to handle both absolute and relative URL formats.
    assert (
        profile_url in uploaded_image_url
        or uploaded_image_url.endswith(profile_url)
        or profile_url.endswith(uploaded_image_url.split("/media/")[-1] if "/media/" in uploaded_image_url else uploaded_image_url)
    ), (
        f"Profile.{field_name} ({profile_url!r}) does not match the uploaded "
        f"photo's image URL ({uploaded_image_url!r}) after uploading a "
        f"{photo_type} photo"
    )


# ---------------------------------------------------------------------------
# Property 11: Avatar/cover URL cleared on delete
# Feature: photo-upload, Property 11: Avatar/cover URL cleared on delete
# ---------------------------------------------------------------------------


@pytest.mark.django_db(transaction=True)
@override_settings(MEDIA_ROOT=_tmp_media)
@given(photo_type=avatar_cover_type_strategy)
@settings(max_examples=100, deadline=None)
def test_avatar_cover_url_cleared_on_delete(photo_type):
    """
    For any profile with an avatar (or cover) photo, deleting that photo
    SHALL set Profile.avatar_url (or cover_url) to null.
    """
    import uuid

    from rest_framework.authtoken.models import Token
    from rest_framework.test import APIClient

    # Fresh user for every example
    unique = uuid.uuid4().hex[:8]
    user, profile = _create_user_with_profile(
        username=f"clr_{unique}",
        email=f"clr_{unique}@test.com",
    )

    # Authenticate
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    # 1. Upload a photo with the generated photo_type (avatar or cover)
    image_file = _create_test_image()
    upload_response = client.post(
        "/api/v1/profiles/me/photos/",
        {"image": image_file, "photo_type": photo_type},
        format="multipart",
    )
    assert upload_response.status_code == 201, (
        f"Expected 201 Created, got {upload_response.status_code}: "
        f"{upload_response.data}"
    )
    assert upload_response.data["status"] == "success"
    photo_id = upload_response.data["data"]["id"]

    # 2. Verify the profile URL field is set (not null) after upload
    profile.refresh_from_db()
    if photo_type == "avatar":
        assert profile.avatar_url is not None and profile.avatar_url != "", (
            f"Profile.avatar_url should be set after uploading an avatar photo, "
            f"but got {profile.avatar_url!r}"
        )
    else:
        assert profile.cover_url is not None and profile.cover_url != "", (
            f"Profile.cover_url should be set after uploading a cover photo, "
            f"but got {profile.cover_url!r}"
        )

    # 3. DELETE the photo
    delete_response = client.delete(
        f"/api/v1/profiles/me/photos/{photo_id}/",
    )
    assert delete_response.status_code == 200, (
        f"Expected 200 OK for delete, got {delete_response.status_code}: "
        f"{delete_response.data}"
    )
    assert delete_response.data["status"] == "success"

    # 4. Refresh the profile from the database
    profile.refresh_from_db()

    # 5. Assert that the corresponding profile URL field is now null/empty
    if photo_type == "avatar":
        assert not profile.avatar_url, (
            f"Profile.avatar_url should be null/empty after deleting the "
            f"avatar photo, but got {profile.avatar_url!r}"
        )
    else:
        assert not profile.cover_url, (
            f"Profile.cover_url should be null/empty after deleting the "
            f"cover photo, but got {profile.cover_url!r}"
        )


# ---------------------------------------------------------------------------
# Unit Tests: Edge Cases and Error Conditions
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@override_settings(MEDIA_ROOT=_tmp_media)
def test_unauthenticated_request_returns_401():
    """
    An unauthenticated request to any photo endpoint SHALL return 401.
    """
    from rest_framework.test import APIClient

    client = APIClient()  # no credentials

    # POST upload
    image_file = _create_test_image()
    post_resp = client.post(
        "/api/v1/profiles/me/photos/",
        {"image": image_file, "photo_type": "avatar"},
        format="multipart",
    )
    assert post_resp.status_code == 401, (
        f"Expected 401 for unauthenticated POST, got {post_resp.status_code}"
    )

    # GET list
    get_resp = client.get("/api/v1/profiles/me/photos/")
    assert get_resp.status_code == 401, (
        f"Expected 401 for unauthenticated GET, got {get_resp.status_code}"
    )

    # DELETE
    import uuid
    fake_id = uuid.uuid4()
    del_resp = client.delete(f"/api/v1/profiles/me/photos/{fake_id}/")
    assert del_resp.status_code == 401, (
        f"Expected 401 for unauthenticated DELETE, got {del_resp.status_code}"
    )

    # PATCH
    patch_resp = client.patch(
        f"/api/v1/profiles/me/photos/{fake_id}/update/",
        {"display_order": 1},
        format="json",
    )
    assert patch_resp.status_code == 401, (
        f"Expected 401 for unauthenticated PATCH, got {patch_resp.status_code}"
    )


@pytest.mark.django_db
@override_settings(MEDIA_ROOT=_tmp_media)
def test_upload_missing_image_field_returns_400():
    """
    A POST upload with a missing 'image' field SHALL return 400.
    """
    from rest_framework.authtoken.models import Token
    from rest_framework.test import APIClient

    user, _profile = _create_user_with_profile("noimg_user", "noimg@test.com")
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    response = client.post(
        "/api/v1/profiles/me/photos/",
        {"photo_type": "avatar"},  # no image field
        format="multipart",
    )

    assert response.status_code == 400, (
        f"Expected 400 for missing image, got {response.status_code}: "
        f"{response.data}"
    )
    assert response.data["status"] == "error"


@pytest.mark.django_db
@override_settings(MEDIA_ROOT=_tmp_media)
def test_upload_missing_photo_type_returns_400():
    """
    A POST upload with a missing 'photo_type' field SHALL return 400.
    """
    from rest_framework.authtoken.models import Token
    from rest_framework.test import APIClient

    user, _profile = _create_user_with_profile("notype_user", "notype@test.com")
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    image_file = _create_test_image()
    response = client.post(
        "/api/v1/profiles/me/photos/",
        {"image": image_file},  # no photo_type field
        format="multipart",
    )

    assert response.status_code == 400, (
        f"Expected 400 for missing photo_type, got {response.status_code}: "
        f"{response.data}"
    )
    assert response.data["status"] == "error"


@pytest.mark.django_db
@override_settings(MEDIA_ROOT=_tmp_media)
def test_upload_invalid_photo_type_returns_400():
    """
    A POST upload with an invalid 'photo_type' value SHALL return 400.
    """
    from rest_framework.authtoken.models import Token
    from rest_framework.test import APIClient

    user, _profile = _create_user_with_profile("badtype_user", "badtype@test.com")
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    image_file = _create_test_image()
    response = client.post(
        "/api/v1/profiles/me/photos/",
        {"image": image_file, "photo_type": "selfie"},  # invalid type
        format="multipart",
    )

    assert response.status_code == 400, (
        f"Expected 400 for invalid photo_type, got {response.status_code}: "
        f"{response.data}"
    )
    assert response.data["status"] == "error"


@pytest.mark.django_db
@override_settings(MEDIA_ROOT=_tmp_media)
def test_upload_corrupt_file_returns_400():
    """
    A POST upload with a corrupt (non-image) file SHALL return 400.
    """
    from rest_framework.authtoken.models import Token
    from rest_framework.test import APIClient

    user, _profile = _create_user_with_profile("corrupt_user", "corrupt@test.com")
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    # Create a file with random bytes that is NOT a valid image
    corrupt_file = SimpleUploadedFile(
        name="corrupt.jpg",
        content=b"this is not an image at all",
        content_type="image/jpeg",
    )

    response = client.post(
        "/api/v1/profiles/me/photos/",
        {"image": corrupt_file, "photo_type": "gallery"},
        format="multipart",
    )

    assert response.status_code == 400, (
        f"Expected 400 for corrupt file, got {response.status_code}: "
        f"{response.data}"
    )
    assert response.data["status"] == "error"


@pytest.mark.django_db
@override_settings(MEDIA_ROOT=_tmp_media)
def test_delete_nonexistent_photo_returns_404():
    """
    A DELETE request for a non-existent photo ID SHALL return 404.
    """
    import uuid

    from rest_framework.authtoken.models import Token
    from rest_framework.test import APIClient

    user, _profile = _create_user_with_profile("del404_user", "del404@test.com")
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    nonexistent_id = uuid.uuid4()
    response = client.delete(f"/api/v1/profiles/me/photos/{nonexistent_id}/")

    assert response.status_code == 404, (
        f"Expected 404 for non-existent photo DELETE, got "
        f"{response.status_code}: {response.data}"
    )
    assert response.data["status"] == "error"
    assert "not found" in response.data["message"].lower()


@pytest.mark.django_db
@override_settings(MEDIA_ROOT=_tmp_media)
def test_patch_nonexistent_photo_returns_404():
    """
    A PATCH request for a non-existent photo ID SHALL return 404.
    """
    import uuid

    from rest_framework.authtoken.models import Token
    from rest_framework.test import APIClient

    user, _profile = _create_user_with_profile("patch404_user", "patch404@test.com")
    token, _ = Token.objects.get_or_create(user=user)
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f"Token {token.key}")

    nonexistent_id = uuid.uuid4()
    response = client.patch(
        f"/api/v1/profiles/me/photos/{nonexistent_id}/update/",
        {"display_order": 5},
        format="json",
    )

    assert response.status_code == 404, (
        f"Expected 404 for non-existent photo PATCH, got "
        f"{response.status_code}: {response.data}"
    )
    assert response.data["status"] == "error"
    assert "not found" in response.data["message"].lower()
