"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Italic, Link as LinkIcon, List, ListOrdered, Heading2, Heading3 } from "lucide-react";
import { cn } from "@/lib/utils";

function ToolbarButton({
  active, onClick, children, label,
}: { active?: boolean; onClick: () => void; children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "flex size-8 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900",
        active && "bg-neutral-900 text-white hover:bg-neutral-900 hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

/** Rich text editor for BlogPost.content — outputs HTML (editor.getHTML()),
 * same format the public site renders via dangerouslySetInnerHTML. */
export function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "prose-sm min-h-48 max-w-none px-3.5 py-3 text-sm text-neutral-900 outline-none [&_a]:text-primary [&_a]:underline [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="flex items-center gap-0.5 border-b border-neutral-200 px-2 py-1.5">
        <ToolbarButton label="Gras" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Italique" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic className="size-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-neutral-200" />
        <ToolbarButton label="Titre H2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Titre H3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="size-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-neutral-200" />
        <ToolbarButton label="Liste à puces" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List className="size-4" />
        </ToolbarButton>
        <ToolbarButton label="Liste numérotée" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered className="size-4" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-neutral-200" />
        <ToolbarButton
          label="Lien"
          active={editor.isActive("link")}
          onClick={() => {
            const url = window.prompt("URL du lien :", editor.getAttributes("link").href ?? "https://");
            if (url === null) return;
            if (url === "") {
              editor.chain().focus().unsetLink().run();
            } else {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
        >
          <LinkIcon className="size-4" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
