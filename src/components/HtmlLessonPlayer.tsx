// Renders an AI-composed single-file HTML lesson inside a sandboxed
// iframe: scripts run (allow-scripts) but the frame gets NO same-origin
// access, so the lesson cannot reach the app, cookies, or storage. This
// is the only way AI-generated HTML ever enters the page — never via
// dangerouslySetInnerHTML.
export function HtmlLessonPlayer({ html, title }: { html: string; title?: string }) {
  return (
    <div className="html-lesson-frame-wrap">
      <iframe
        className="html-lesson-frame"
        title={title ?? 'Bài học HTML'}
        sandbox="allow-scripts"
        srcDoc={html}
      />
    </div>
  );
}
