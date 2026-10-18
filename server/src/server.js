import { app } from './app.js';
import { connectDatabase } from './config/database.js';
import { Document, KnowledgeChunk } from './models/index.js';
import {
  createCloudinaryDocumentStorage,
  createDocumentCleanupService,
  createAiServiceClient,
  createDocumentMaintenanceService,
  createDocumentProcessingService,
  createDocumentService,
  createKnowledgeChunkService,
} from './services/index.js';

const host = '127.0.0.1';
const port = Number(process.env.PORT || 5000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be a whole number between 1 and 65535.');
}

let server;

async function recoverInterruptedDocumentWork() {
  const storageConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME
    && process.env.CLOUDINARY_API_KEY
    && process.env.CLOUDINARY_API_SECRET,
  );
  if (!storageConfigured || !process.env.AI_SERVICE_URL || !process.env.AI_SERVICE_TOKEN) return;

  const documentService = createDocumentService(Document);
  const knowledgeChunkService = createKnowledgeChunkService(KnowledgeChunk);
  const documentStorage = createCloudinaryDocumentStorage();
  const documentProcessingService = createDocumentProcessingService({
    documentService,
    documentStorage,
    knowledgeChunkService,
    getExtractionClient: () => createAiServiceClient(),
  });
  const documentCleanupService = createDocumentCleanupService({
    documentService,
    documentStorage,
    knowledgeChunkService,
    getSemanticSearchClient: () => createAiServiceClient(),
  });
  const result = await createDocumentMaintenanceService({
    documentService,
    documentProcessingService,
    documentCleanupService,
  }).recover();
  const attempted = result.processingResults.length + result.deletionResults.length;
  if (attempted) console.log(`Recovered ${attempted} interrupted document job${attempted === 1 ? '' : 's'}.`);
}

try {
  await connectDatabase();
  server = app.listen(port, host, () => {
    console.log(`AI Notes API is running at http://${host}:${port}`);
    recoverInterruptedDocumentWork().catch(() => {
      console.error('Interrupted document cleanup could not finish. It will retry after the next API restart.');
    });
  });
} catch (error) {
  console.error('Could not connect to MongoDB. Check the server environment configuration and Atlas network access.');
  process.exit(1);
}

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is already in use. Stop the other server or choose another PORT.`
    : `Could not start the API: ${error.message}`);
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
