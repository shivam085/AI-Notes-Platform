import { randomUUID } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';

export class DocumentStorageConfigurationError extends Error {}
export class DocumentStorageError extends Error {}

function readConfiguration() {
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  };
}

export function createCloudinaryDocumentStorage({ configuration = readConfiguration(), cloudinaryInstance = cloudinary } = {}) {
  const { cloudName, apiKey, apiSecret } = configuration;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new DocumentStorageConfigurationError('Document storage is not configured on the server yet.');
  }

  cloudinaryInstance.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

  return {
    async uploadPdf({ buffer, ownerId, originalName }) {
      const result = await new Promise((resolve, reject) => {
        const stream = cloudinaryInstance.uploader.upload_stream({
          resource_type: 'raw',
          type: 'private',
          folder: `ai-notes/${ownerId}`,
          public_id: randomUUID(),
          filename_override: originalName,
          overwrite: false,
        }, (error, response) => {
          if (error) return reject(new DocumentStorageError('Cloud storage could not save this PDF.'));
          return resolve(response);
        });
        stream.end(buffer);
      });

      if (!result?.public_id) throw new DocumentStorageError('Cloud storage did not return a file identifier.');
      return { publicId: result.public_id };
    },
    async remove(publicId) {
      try {
        const result = await cloudinaryInstance.uploader.destroy(publicId, { resource_type: 'raw', type: 'private', invalidate: true });
        if (!['ok', 'not found'].includes(result?.result)) throw new DocumentStorageError('Cloud storage could not delete this PDF.');
      } catch (error) {
        if (error instanceof DocumentStorageError) throw error;
        throw new DocumentStorageError('Cloud storage could not delete this PDF.');
      }
    },
    createAccessUrl({ publicId, format, download }) {
      return cloudinaryInstance.utils.private_download_url(publicId, format, {
        resource_type: 'raw',
        type: 'private',
        attachment: download,
        expires_at: Math.floor(Date.now() / 1000) + 300,
      });
    },
  };
}
