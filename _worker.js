import { onRequestPost as generateJournal } from "./functions/generate-journal.js";
import { onRequestGet as listJournals } from "./functions/list-journals.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API Routing: Generate Journal
    if (url.pathname === "/generate-journal" && request.method === "POST") {
      return generateJournal({ request, env });
    }

    // API Routing: List Journals
    if (url.pathname === "/list-journals" && request.method === "GET") {
      return listJournals({ request, env });
    }

    // Default: Serve Static Assets (index.html, journal.html, styles.css, etc.)
    return env.ASSETS.fetch(request);
  }
};
