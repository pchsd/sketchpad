import { Editor, EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Text from "@tiptap/extension-text"

export default function TipTap({
  content,
  onUpdate,
}:{
  content: string
  onUpdate: ({ editor }:{ editor: Editor }) => void
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Text,
    ],

    content: content,
  
    editorProps: {
      attributes: {
        class: 'px-6 py-9 min-h-64 focus:outline-none',
      },
    },
  
    onUpdate: onUpdate,
  })

  return (
    <EditorContent editor={editor} />
  )
}
