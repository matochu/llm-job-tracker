#!/usr/bin/env node
import { commandText, printClaudeDeny, readEvent, toolInput, toolName, warn } from './hooklib.js';

const sendPatterns = [
  /\b(send|submit|apply)\b.*\b(linkedin|email|gmail|mail|message|connection|connect)\b/,
  /\b(linkedin|email|gmail|mail|message|connection|connect)\b.*\b(send|submit|apply)\b/,
  /\bmailto:/,
  /\bgh\s+pr\s+merge\b/,
  /\bgit\s+push\b/,
];
const browserSendPatterns = [
  /\b(send|submit|apply|connect)\b/,
  /\b(connection request|send message|send email)\b/,
];
const applicationSubmitAllowMarker = 'USER_CONFIRMED_ATS_APPLICATION';
const riskyRedirectPatterns = [
  />\s*tracker\.md\b/,
  />\s*data\/companies\/[^ ]+\/resume\.md\b/,
  />\s*data\/companies\/[^ ]+\/prep-notes\.md\b/,
  />\s*candidate\/cv\/cv-base\.md\b/,
];
const prepNotesPathPattern = /data\/companies\/[^"'\s]+\/prep-notes\.md/;
const prepNotesDraftWarningPatterns = [/###\s+Manual Message Drafts/i];
const prepNotesClaimBlockPatterns = [
  /\b(outreach|message|email|linkedin|connection|application)\s+status\s*:\s*(sent|submitted|applied|contacted|connected)\b/i,
  /\b(marked|set|updated)\s+(as|to)\s+(sent|submitted|applied|contacted|connected)\b/i,
  /\b(message|email|linkedin message|connection request|application|outreach)\s+(sent|submitted|applied|contacted|connected)\b/i,
];

function deny(reason) {
  printClaudeDeny(reason);
  console.error(reason);
  return 2;
}

function main() {
  const event = readEvent();
  const name = toolName(event);
  const text = commandText(event);
  const rawInput = String(JSON.stringify(toolInput(event)));
  const combinedText = [text, rawInput].filter(Boolean).join('\n');
  if (!combinedText) return 0;
  const normalized = combinedText.toLowerCase();

  if (['browser', 'playwright', 'chrome'].some((token) => name.toLowerCase().includes(token))) {
    for (const pattern of browserSendPatterns) {
      if (!pattern.test(normalized)) continue;
      const isApplicationSubmit = /\b(submit|apply)\b/.test(normalized) && /\b(application|ats|job application|application form)\b/.test(normalized);
      const isOutreachAction = /\b(send|connect|connection request|send message|send email|linkedin|email|gmail|mail|message)\b/.test(normalized);
      if (normalized.includes(applicationSubmitAllowMarker.toLowerCase()) && isApplicationSubmit && !isOutreachAction) continue;
      return deny('Blocked by job-search hook: browser outreach/application actions must remain manual.');
    }
  }

  if (['Bash', 'bash', 'functions.exec_command'].includes(name)) {
    for (const pattern of sendPatterns) {
      if (pattern.test(normalized)) return deny('Blocked by job-search hook: draft outreach only; do not send/apply/connect from the agent.');
    }
    for (const pattern of riskyRedirectPatterns) {
      if (pattern.test(combinedText)) return deny('Blocked by job-search hook: edit tracker/CV/prep-notes with a structured edit tool, not shell redirection.');
    }
  }

  if (prepNotesPathPattern.test(combinedText)) {
    for (const pattern of prepNotesClaimBlockPatterns) {
      if (pattern.test(normalized)) return deny('Blocked by job-search hook: sent/applied/contacted outreach claims require explicit user confirmation and must not be created by direct prep-notes edits.');
    }
    for (const pattern of prepNotesDraftWarningPatterns) {
      if (pattern.test(combinedText)) warn('Job-search hook reminder: Manual Message Drafts should be produced by job:draft, not reconstructed directly from context.');
    }
  }
  return 0;
}

process.exitCode = main();
