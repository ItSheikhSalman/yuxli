const { randomUUID, createHash } = require("node:crypto");
const repository = require("./repository.cjs");
const { text } = require("./personas.cjs");
const { SECRET } = require("./signals.cjs");

const EXTENSIONS = ["txt", "md", "json", "csv"];
const tokens = (value) =>
  [
    ...new Set(
      String(value)
        .toLowerCase()
        .match(/[\p{L}\p{N}+#]{2,}/gu) || [],
    ),
  ].slice(0, 60);

function source(input = {}) {
  const kind = [
    "general",
    "faq",
    "business",
    "education",
    "quran",
    "hadith",
    "scholarly",
    "medical",
  ].includes(input.kind)
    ? input.kind
    : "general";
  const url = text(input.url, 1000);
  if (url) {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      throw repository.error("Invalid source URL");
    }
    if (parsed.protocol !== "https:" || parsed.username || parsed.password)
      throw repository.error("Source links must use HTTPS without credentials");
  }
  return {
    kind,
    url,
    reference: text(input.reference, 250),
    edition: text(input.edition, 250),
    author: text(input.author, 250),
    verifiedAt: input.verifiedAt ? text(input.verifiedAt, 40) : null,
  };
}

function ingest(workspaceId, input, actorId) {
  repository.workspace(workspaceId);
  const filename = text(input.filename, 160, "knowledge.txt");
  const extension = filename.split(".").pop().toLowerCase();
  if (!EXTENSIONS.includes(extension))
    throw repository.error(
      "Supported uploads: TXT, Markdown, JSON, CSV. PDF/DOCX extraction is not installed; import reviewed text instead.",
      415,
      "FORMAT_UNSUPPORTED",
    );
  let content = text(input.content, 1000000);
  if (!content || content.includes("\0") || /\uFFFD/u.test(content))
    throw repository.error("Expected valid UTF-8 text");
  if (SECRET.test(content))
    throw repository.error("Remove secrets and sensitive identifiers before ingestion");
  if (extension === "json") {
    try {
      content = JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      throw repository.error("Invalid JSON document");
    }
  }
  const metadata = source(input.source);
  const scope = input.scope === "group" ? "group" : "workspace";
  const chatId = scope === "group" ? text(input.chatId, 150) : null;
  if (scope === "group" && !chatId) throw repository.error("Group ID required");
  const bytes = Buffer.byteLength(content);
  const cap = repository.limits(workspaceId);
  const documents = repository.list(workspaceId, "document");
  if (documents.reduce((sum, item) => sum + item.bytes, 0) + bytes > cap.knowledgeBytes)
    throw repository.error("Knowledge storage quota exceeded", 429, "TRAINING_QUOTA");
  const fingerprint = createHash("sha256").update(content).digest("hex");
  const duplicate = documents.find(
    (document) =>
      document.fingerprint === fingerprint &&
      document.scope === scope &&
      document.chatId === chatId,
  );
  if (duplicate) return duplicate;
  const document = repository.put(
    workspaceId,
    "document",
    {
      name: text(input.name, 160, filename),
      filename,
      source: metadata,
      scope,
      chatId,
      bytes,
      fingerprint,
      ownerId: actorId,
      expiresAt:
        Date.now() + Math.min(repository.limits(workspaceId).retentionDays, 365) * 86400000,
    },
    actorId,
    { id: randomUUID() },
  );
  try {
    repository.transaction(() => {
      let ordinal = 0;
      for (let offset = 0; offset < content.length; offset += 900) {
        repository
          .q("INSERT INTO ai_knowledge_chunks VALUES (?, ?, ?, ?)")
          .run(workspaceId, document.id, ordinal, content.slice(offset, offset + 1100));
        repository
          .q(
            "INSERT INTO ai_knowledge_index(workspace_id,document_id,ordinal,content) VALUES (?, ?, ?, ?)",
          )
          .run(workspaceId, document.id, ordinal++, content.slice(offset, offset + 1100));
      }
    });
  } catch (cause) {
    repository.remove(workspaceId, "document", document.id, actorId);
    throw cause;
  }
  return document;
}

function approve(workspaceId, id, actorId, revision) {
  const document = repository.get(workspaceId, "document", id);
  if (!document) throw repository.error("Document not found", 404);
  if (
    ["quran", "hadith", "scholarly", "medical"].includes(document.source.kind) &&
    (!document.source.url || !document.source.reference || !document.source.edition)
  )
    throw repository.error("Reviewed references require source URL, reference and edition");
  return repository.put(
    workspaceId,
    "document",
    {
      ...document,
      source: { ...document.source, verifiedAt: new Date().toISOString() },
      approvedBy: actorId,
    },
    actorId,
    { id, revision, approved: true },
  );
}

function retrieve(workspaceId, query, { chatId, sources = [], maxChars = 6000, kind = null } = {}) {
  repository.workspace(workspaceId);
  const terms = tokens(query).filter(
    (term) =>
      ![
        "the",
        "what",
        "this",
        "that",
        "hai",
        "kya",
        "please",
        "about",
        "with",
        "from",
        "have",
      ].includes(term),
  );
  if (!terms.length) return [];
  const documents = repository
    .list(workspaceId, "document")
    .filter(
      (document) =>
        document.approved &&
        document.expiresAt > Date.now() &&
        (document.scope === "workspace" || document.chatId === chatId) &&
        (!sources.length || sources.includes(document.id)) &&
        (!kind ||
          (kind === "islamic"
            ? ["quran", "hadith", "scholarly"].includes(document.source.kind)
            : document.source.kind === kind)),
    );
  const candidates = [];
  if (!documents.length) return [];
  const documentMap = new Map(documents.map((document) => [document.id, document]));
  const match = terms.map((term) => `"${term.replaceAll('"', '""')}"`).join(" OR ");
  const chunks = repository
    .q(
      `SELECT document_id,ordinal,content FROM ai_knowledge_index WHERE workspace_id=? AND document_id IN (${documents.map(() => "?").join(",")}) AND ai_knowledge_index MATCH ? ORDER BY rank LIMIT 40`,
    )
    .all(workspaceId, ...documents.map((document) => document.id), match);
  for (const chunk of chunks) {
    const document = documentMap.get(chunk.document_id);
    const lower = chunk.content.toLowerCase();
    const matches = terms.filter((term) => lower.includes(term));
    if (!matches.length) continue;
    candidates.push({
      id: `${document.id}:${chunk.ordinal}`,
      documentId: document.id,
      title: document.name,
      content: chunk.content,
      source: document.source,
      score: matches.length / terms.length,
      verified: Boolean(document.source.verifiedAt),
      kind: document.source.kind,
    });
  }
  let remaining = Math.min(8000, maxChars);
  return candidates
    .sort((first, second) => second.score - first.score || first.id.localeCompare(second.id))
    .slice(0, 5)
    .flatMap((chunk) => {
      if (remaining < 200) return [];
      const content = chunk.content.slice(0, remaining);
      remaining -= content.length;
      return [{ ...chunk, content }];
    });
}

module.exports = { EXTENSIONS, tokens, ingest, approve, retrieve };
