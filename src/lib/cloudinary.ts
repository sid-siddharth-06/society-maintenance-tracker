import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary from server-side environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
}

/**
 * Uploads a complaint photo buffer to Cloudinary.
 * Keeps the upload fully server-side without exposing secrets to the client.
 */
export async function uploadComplaintPhoto(buffer: Buffer): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return reject(new Error('Cloudinary environment variables are missing.'));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'society-maintenance-tracker/complaints',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
          });
        } else {
          reject(new Error('Unknown Cloudinary upload error.'));
        }
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Best-effort deletion of an uploaded photo.
 * Used for compensating cleanup if the database operation fails after upload.
 */
export async function deleteComplaintPhoto(publicId: string): Promise<void> {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME) return;
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    // Log the error but do not throw, since this is best-effort cleanup
    console.error(`Failed to delete Cloudinary asset ${publicId}:`, error);
  }
}
