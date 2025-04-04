import { useEffect, useState } from "react"
import { diffChars } from 'diff'
import dynamic from 'next/dynamic'
import Version from "@/types/Version"
import CodeMirror, { EditorView } from '@uiw/react-codemirror'

export const Sketchpad = dynamic(() => Promise.resolve(SketchpadSSR), {
  ssr: false
})

type OperationType = 'insert' | 'delete' | 'none' | 'mixture'

const dbName = 'sketchpadDB'
const objectStoreName = 'versionHistoryStore'

function SketchpadSSR() {
  const [lastOperationType, setLastOperationType] = useState<OperationType>('none')
  
  const [count, setCount] = useState(0)
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
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBRequest).result as IDBDatabase

      if (!db.objectStoreNames.contains(objectStoreName)) {
        db.createObjectStore(objectStoreName, { autoIncrement: true })
      }
    }
  }

  const addVersionToIndexedDB = (version: Version) => {
    if (!db) {
      console.error("db is null")
      return
    }

    const transaction = db.transaction(objectStoreName, 'readwrite')
    const objectStore = transaction.objectStore(objectStoreName)
    const putRequest = objectStore.add(version)

    putRequest.onerror = (event) => {
      console.error("Error saving version history to IndexedDB: ", event)
    }
  }

  const updateVersionInIndexedDB = (version: Version, key: number) => {
    if (!db) {
      console.error("db is null")
      return
    }

    const transaction = db.transaction(objectStoreName, 'readwrite')
    const objectStore = transaction.objectStore(objectStoreName)
    const putRequest = objectStore.put(version, key)

    putRequest.onerror = (event) => {
      console.error("Error saving version history to IndexedDB: ", event)
    }
  }

  const getRowCountFromIndexedDB = (callback: (rowCount: number) => void) => {
    if (!db) return

    const transaction = db.transaction(objectStoreName, 'readonly')
    const objectStore = transaction.objectStore(objectStoreName)
    const getRowCount = objectStore.count()

    getRowCount.onsuccess = (event) => {
      const rowCount = (event.target as IDBRequest).result as number
      callback(rowCount)
    }

    getRowCount.onerror = (event) => {
      console.error("Error loading version history from IndexedDB: ", event)
    }
  }
  
  const getLastVersionFromIndexedDB = (callback: (version?: Version) => void) => {
    if (!db) return

    getRowCountFromIndexedDB((rowCount) => {
      const transaction = db.transaction(objectStoreName, 'readonly')
      const objectStore = transaction.objectStore(objectStoreName)

      if (rowCount <= 0) {
        callback()
      } else {
        const getLastRow = objectStore.get(rowCount)

        getLastRow.onsuccess = (event) => {
          const lastRow = (event.target as IDBRequest).result as Version
          callback(lastRow)
        }
  
        getLastRow.onerror = (event) => {
          throw new Error(`Error loading version history from IndexedDB: ${JSON.stringify(event)}`)
        }
      }
    })
  }

  useEffect(() => {
    getLastVersionFromIndexedDB((lastVersion) => {         
      if (lastVersion) {
        setInitialEditorText(lastVersion.text)
      }

      setIsInitializingIndexDB(false)
    })
  }, [db])

  useEffect(() => {
    initIndexedDB()

    return () => {
      if (db) {
        db.close()
      }
    }
  }, [])

  const handleChange = (value: string) => {
    getLastVersionFromIndexedDB((lastRow) => {
      const currentVersion = { text: value, timestamp: new Date() }

      if (!lastRow) {
        addVersionToIndexedDB(currentVersion)
        return
      }

      const diff = diffChars(lastRow.text, value)
      
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
      
      let operationType: OperationType = 'none'

      if (insertions > 0 && deletions === 0) {
        operationType = 'insert'
      } else if (deletions > 0 && insertions === 0) {
        operationType = 'delete'
      } else if (insertions > 0 && deletions > 0) {
        operationType = 'mixture'
      } else {
        operationType = 'none'
      }
 
      if (operationType === 'none') {
        return
      }

      const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000)
      const lastVersionTimestamp = new Date(lastRow.timestamp)

      if (
        lastOperationType === operationType &&
        operationType !== 'mixture' &&
        lastVersionTimestamp > threeMinutesAgo
      ) {
        // Replace last version when continuous same type of edit (insert or delete)
        getRowCountFromIndexedDB((rowCount) => {
          updateVersionInIndexedDB(currentVersion, rowCount)
        })
      } else {
        // Add new version when switch in operation type or first operation
        addVersionToIndexedDB(currentVersion)
        setCount(count + 1)
      }
      
      setLastOperationType(operationType)
    })
  }
  
  if (isInitializingIndexDB) {
    return <div>Loading...</div>
  }

  return (
    <div className="flex flex-col items-center h-screen">
      <div className="w-136 max-w-screen h-full flex flex-col">
        <p>{count.toLocaleString()} versions saved for this session.</p>
        <p>{"Take a break if you're feeling anxious!"}</p>

        <CodeMirror
          value={initialEditorText}
          extensions={[EditorView.lineWrapping]}
          onChange={handleChange}
        />
      </div>
    </div>
  )
}
