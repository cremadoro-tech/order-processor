const { getDocs, getDrive } = require('./auth');
const config = require('../utils/config');

async function findOrCreateFolder(parentId, folderName) {
  const drive = await getDrive();

  // 既存フォルダを検索
  const res = await drive.files.list({
    q: `'${parentId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  // フォルダ作成
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    },
    fields: 'id',
  });

  return folder.data.id;
}

async function ensureFolderStructure(year, month) {
  const rootFolderId = config.google.driveFolderId;
  const yearFolderId = await findOrCreateFolder(rootFolderId, `${year}年`);
  const monthStr = String(month).padStart(2, '0');
  const monthFolderId = await findOrCreateFolder(yearFolderId, `${monthStr}月`);
  return monthFolderId;
}

async function findOrCreateMonthlyDoc(year, month) {
  const monthFolderId = await ensureFolderStructure(year, month);
  const drive = await getDrive();
  const monthStr = String(month).padStart(2, '0');
  const docTitle = `日報_${year}-${monthStr}月`;

  // 既存Docを検索
  const res = await drive.files.list({
    q: `'${monthFolderId}' in parents and name = '${docTitle}' and mimeType = 'application/vnd.google-apps.document' and trashed = false`,
    fields: 'files(id, name)',
  });

  if (res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  // Doc新規作成
  const doc = await drive.files.create({
    requestBody: {
      name: docTitle,
      mimeType: 'application/vnd.google-apps.document',
      parents: [monthFolderId],
    },
    fields: 'id',
  });

  return doc.data.id;
}

async function appendDailyReport(docId, reportText) {
  const docs = await getDocs();

  // 既存Docの末尾位置を取得
  const doc = await docs.documents.get({ documentId: docId });
  const endIndex = doc.data.body.content[doc.data.body.content.length - 1].endIndex - 1;

  const separator = '\n━━━━━━━━━━━━━━━━━━━━\n\n';
  const textToInsert = endIndex > 1 ? separator + reportText + '\n' : reportText + '\n';

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: endIndex },
            text: textToInsert,
          },
        },
      ],
    },
  });
}

async function getMonthlyReports(year, month) {
  const docId = await findOrCreateMonthlyDoc(year, month);
  const docs = await getDocs();
  const doc = await docs.documents.get({ documentId: docId });

  // ドキュメントの全テキストを取得
  let fullText = '';
  for (const element of doc.data.body.content) {
    if (element.paragraph) {
      for (const el of element.paragraph.elements) {
        if (el.textRun) {
          fullText += el.textRun.content;
        }
      }
    }
  }

  return fullText;
}

async function createReportDoc(title, content, year, month) {
  const monthFolderId = await ensureFolderStructure(year, month);
  const drive = await getDrive();
  const docs = await getDocs();

  // Doc新規作成
  const file = await drive.files.create({
    requestBody: {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      parents: [monthFolderId],
    },
    fields: 'id',
  });

  const docId = file.data.id;

  // コンテンツを書き込み
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: content,
          },
        },
      ],
    },
  });

  return docId;
}

async function insertImageToDoc(docId, imageUrl, index) {
  const docs = await getDocs();

  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertInlineImage: {
            location: { index },
            uri: imageUrl,
            objectSize: {
              width: { magnitude: 500, unit: 'PT' },
              height: { magnitude: 250, unit: 'PT' },
            },
          },
        },
      ],
    },
  });
}

function getDocUrl(docId) {
  return `https://docs.google.com/document/d/${docId}/edit`;
}

module.exports = {
  findOrCreateFolder,
  ensureFolderStructure,
  findOrCreateMonthlyDoc,
  appendDailyReport,
  getMonthlyReports,
  createReportDoc,
  insertImageToDoc,
  getDocUrl,
};
