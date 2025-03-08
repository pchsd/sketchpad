import { useEffect, useRef, useState } from "react"
import { diffChars } from 'diff'

interface Version {
  text: string
  timestamp: Date
}

export default function Home() {
  type OperationType = 'insert' | 'delete' | 'none' | 'mixture'

  const defaultText = ''

  const [text, setText] = useState(defaultText)

  const [previousText, setPreviousText] = useState(defaultText)
  const [lastOperationType, setLastOperationType] = useState<OperationType>('none')
  
  const [versionHistory, setVersionHistory] = useState<Version[]>([])
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    // Initialize version history with the initial empty text
    setVersionHistory([{ text: text, timestamp: new Date() }])
  }, [])

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value
    setText(newText)

    const diff = diffChars(previousText, newText)
    
    let operationType: OperationType = 'none'
    
    let insertions = 0
    let deletions = 0
    let common = 0

    diff.forEach(part => {
      if (part.added) {
        if (part.count) {
          insertions += part.count
        }
      } else if (part.removed) {
        if (part.count) {
          deletions += part.count
        }
      } else {
        if (part.count) {
          common += part.count
        }
      }
    })

    if (insertions > 0 && deletions === 0) {
      operationType = 'insert'
    } else if (deletions > 0 && insertions === 0) {
      operationType = 'delete'
    } else if (insertions > 0 && deletions > 0) {
      operationType = 'mixture'
    } else {
      operationType = 'none'
    }

    setPreviousText(newText)

    setVersionHistory(prevHistory => {
      const currentVersion = { text: newText, timestamp: new Date() }

      if (prevHistory.length === 0) {
        return [currentVersion] // Initial case
      }

      const historyCopy = [...prevHistory]
      
      

      if (operationType === 'none') {
        return historyCopy
      }

      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000)

      if (
        lastOperationType === operationType &&
        operationType !== 'mixture' &&
        new Date(historyCopy[0].timestamp) > threeMinutesAgo
      ) {
        // Continuous same type of edit (insert or delete), replace last version
        historyCopy[0] = currentVersion;
        return historyCopy;
      } else {
        // Switch in operation type or first operation or switch operation, add new version
        return [currentVersion, ...historyCopy];
      }
    })

    setLastOperationType(operationType)
  }

  return (
    <div className="container">
      <div className="editor-container">
        <textarea
          ref={textareaRef}
          className="editor"
          value={text}
          onChange={handleTextChange}
          placeholder="Start typing here..."
        />
      </div>

      <div className="history-container">
        <h2>Version History</h2>
        {versionHistory.length > 0 ? (
          <ul className="history-list">
            {versionHistory.map((version, index) => (
              <li key={index} className="history-item">
                <div>
                  {version.text.length > 0 ? (
                    <pre className="history-text">{version.text}</pre>
                  ) : (
                    <pre className="text-gray-600">Empty</pre>
                  )}

                  <pre className="history-text">{version.timestamp.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true,
                  })}</pre>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No versions yet.</p>
        )}
      </div>
    </div>
  )
}
