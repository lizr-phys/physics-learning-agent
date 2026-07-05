# Retrieval-Augmented Learning Notes

This directory contains the lightweight retrieval layer used by Physics Learning Agent.

## Current implementation

- `sample-docs/` stores small Markdown examples for local development.
- `chunk.ts` uses LangChain document splitters for Markdown, LaTeX, and plain text.
- `retrieve.ts` performs simple keyword scoring and returns source, heading, and content.
- Authenticated users can upload text-like files from the Personal Knowledge page. Those files are indexed separately under `PLA_DATA_DIR` and retrieved during chat.

The current implementation uses LangChain for document abstraction and text splitting, but it does not require a vector database and does not assume that DeepSeek provides embeddings.

## Indexed file types

The personal knowledge base currently indexes:

- Markdown
- TXT
- TeX
- CSV

PDF, DOCX, and PPTX files can be stored in the catalog, but full text extraction is not enabled yet. Add dedicated parsers before relying on those formats for retrieval.

## Extension path

Recommended next steps:

1. Add robust PDF, DOCX, and PPTX text extraction.
2. Preserve document metadata such as course, topic, page, section, and source type.
3. Add embeddings with a provider that performs well on both Chinese and English technical text.
4. Add LangChain retrievers backed by a vector store such as LanceDB, Chroma, pgvector, or Supabase Vector.
5. Combine vector retrieval with keyword retrieval for formulas, symbols, and textbook terminology.
6. Add a reranker and retrieval evaluation set for common physics questions.
7. Display citations using document names, sections, and chunk headings. Do not invent page numbers.

## Copyright note

Do not commit copyrighted textbooks or protected course materials to a public repository. The intended use is local, user-owned notes, lecture summaries, problem solutions, and materials the user has permission to process.
