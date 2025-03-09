import { useCallback, useEffect, useState } from "react"
import { diffChars } from 'diff'
import dynamic from 'next/dynamic'
import Version from "@/types/Version"
import CodeMirror from '@uiw/react-codemirror'

export const Sketchpad = dynamic(() => Promise.resolve(SketchpadSSR), {
  ssr: false
})

type OperationType = 'insert' | 'delete' | 'none' | 'mixture'

const dbName = 'sketchpadDB'
const objectStoreName = 'versionHistoryStore'
const versionHistoryKey = 'versionHistoryData'

function SketchpadSSR() {
  const [lastOperationType, setLastOperationType] = useState<OperationType>('none')
  const [versionHistory, setVersionHistory] = useState<Version[]>([])
  
  const [db, setDb] = useState<IDBDatabase | null>(null)
  const [initialEditorText, setInitialEditorText] = useState<string>('')

  const [isInitializingIndexDB, setIsInitializingIndexDB] = useState(true)


  const initIndexedDB = () => {
    const request = indexedDB.open(dbName, 1)

    request.onerror = (event) => {
      console.error("IndexedDB error: ", event)
    }

    request.onsuccess = () => {
      setDb(request.result)
      loadVersionHistoryFromIndexedDB(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBRequest).result as IDBDatabase

      if (!db.objectStoreNames.contains(objectStoreName)) {
        db.createObjectStore(objectStoreName)
      }
    }
  }

  const loadVersionHistoryFromIndexedDB = (currentDb: IDBDatabase) => {
    if (!currentDb) return

    const transaction = currentDb.transaction(objectStoreName, 'readonly')
    const objectStore = transaction.objectStore(objectStoreName)
    const getRequest = objectStore.get(versionHistoryKey)

    getRequest.onsuccess = (event) => {
      const storedHistory = (event.target as IDBRequest).result as Version[]
      if (storedHistory && storedHistory.length > 0) {
        setVersionHistory(storedHistory)
      }
    }

    getRequest.onerror = (event) => {
      console.error("Error loading version history from IndexedDB: ", event)
    }

    setIsInitializingIndexDB(false)
  }

  const saveVersionHistoryToIndexedDB = (historyToSave: Version[]) => {
    if (!db) return

    const transaction = db.transaction(objectStoreName, 'readwrite')
    const objectStore = transaction.objectStore(objectStoreName)
    const putRequest = objectStore.put(historyToSave, versionHistoryKey)

    putRequest.onerror = (event) => {
      console.error("Error saving version history to IndexedDB: ", event)
    }
  }

  useEffect(() => {
    if (!db) return

    const loadVersionHistoryFromIndexedDB = () => {
      const transaction = db.transaction(objectStoreName, 'readonly')
      const objectStore = transaction.objectStore(objectStoreName)
      const getRequest = objectStore.get(versionHistoryKey)

      getRequest.onsuccess = (event) => {
        const storedHistory = (event.target as IDBRequest).result as Version[]
        
        if (storedHistory && storedHistory.length > 0) {
          setVersionHistory(storedHistory)
          setInitialEditorText(storedHistory[0].text)
        }

        setIsInitializingIndexDB(false)
      }

      getRequest.onerror = (event) => {
        console.error("Error loading version history from IndexedDB: ", event)
        setIsInitializingIndexDB(false)
      }
    }

    loadVersionHistoryFromIndexedDB()
  }, [db])

  useEffect(() => {
    initIndexedDB()

    return () => {
      if (db) {
        db.close()
      }
    }
  }, [])

  const handleChange = useCallback((value: string) => {
    const currentVersion = { text: value, timestamp: new Date() }

    if (versionHistory.length === 0) {
      setVersionHistory([currentVersion])
      return
    }

    const diff = diffChars(versionHistory[0].text, value)

    let operationType: OperationType = 'none'

    let insertions = 0
    let deletions = 0

    diff.forEach(part => {
      if (part.added) {
        if (part.count) {
          insertions += part.count
        }
      } else if (part.removed) {
        if (part.count) {
          deletions += part.count
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

    const buildNewVersionHistory = (): Version[] => {
      if (versionHistory.length === 0) {
        return [currentVersion] // Initial case
      }

      const historyCopy = [...versionHistory]

      if (operationType === 'none') {
        return historyCopy
      }

      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000)

      if (
        lastOperationType === operationType &&
        operationType !== 'mixture' &&
        new Date(historyCopy[0].timestamp) > threeMinutesAgo
      ) {
        // Replace last version when continuous same type of edit (insert or delete)
        historyCopy[0] = currentVersion
        return historyCopy
      } else {
        // Add new version when switch in operation type or first operation
        return [currentVersion, ...historyCopy]
      }
    }

    const newVersionHistory = buildNewVersionHistory()
    
    setVersionHistory(newVersionHistory)
    
    setLastOperationType(operationType)
  }, [])

  useEffect(() => {
    if (versionHistory.length > 0) {
      saveVersionHistoryToIndexedDB(versionHistory)
    }
  }, [versionHistory])
  
  if (isInitializingIndexDB) {
    return <div>Loading...</div>
  }

  return (
    <div className="container">
      <div className="editor-container">
        <CodeMirror height="500px" value={initialEditorText} onChange={handleChange} />
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

                  <pre className="history-text">
                    {version.timestamp.toLocaleDateString("en-US", {
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
