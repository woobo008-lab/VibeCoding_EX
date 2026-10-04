import { useEffect, useRef, useState } from 'react'
import { divIcon } from 'leaflet'
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const PIN_CATEGORIES = [
  { name: '맛집', color: '#ef4444' },
  { name: '카페', color: '#ef4444' },
  { name: '주차장', color: '#3b82f6' },
  { name: '공원', color: '#22c55e' },
  { name: '기타', color: '#94a3b8' },
]
const PIN_CATEGORY_BY_NAME = Object.fromEntries(
  PIN_CATEGORIES.map((category) => [category.name, category]),
)
const PIN_ICONS = Object.fromEntries(
  PIN_CATEGORIES.map(({ name, color }) => [
    name,
    divIcon({
      className: 'custom-map-pin',
      html: `<svg viewBox="0 0 36 44" aria-hidden="true"><path d="M18 1C8.6 1 1 8.6 1 18c0 12 17 25 17 25s17-13 17-25C35 8.6 27.4 1 18 1Z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="18" cy="18" r="6" fill="white"/></svg>`,
      iconSize: [36, 44],
      iconAnchor: [18, 44],
      popupAnchor: [0, -40],
    }),
  ]),
)

function getPinCategory(categoryName) {
  return PIN_CATEGORY_BY_NAME[categoryName] ?? PIN_CATEGORY_BY_NAME['기타']
}

const DEFAULT_PINS = [
  { id: 1, name: '서울역', position: [37.5547, 126.9706] },
  { id: 2, name: '강남역', position: [37.4979, 127.0276] },
  { id: 3, name: '홍대입구', position: [37.5572, 126.9247] },
  { id: 4, name: '잠실', position: [37.5113, 127.098] },
]

const PIN_STORAGE_KEY = 'inter-map-pins'

function isValidPin(pin) {
  return (
    pin &&
    (typeof pin.id === 'string' || typeof pin.id === 'number') &&
    Array.isArray(pin.position) &&
    pin.position.length === 2 &&
    pin.position.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)) &&
    pin.position[0] >= -90 &&
    pin.position[0] <= 90 &&
    pin.position[1] >= -180 &&
    pin.position[1] <= 180 &&
    (pin.name === undefined || typeof pin.name === 'string') &&
    (pin.memo === undefined || typeof pin.memo === 'string') &&
    (pin.category === undefined ||
      (typeof pin.category === 'string' && PIN_CATEGORY_BY_NAME[pin.category]))
  )
}

function loadPins() {
  let savedPins
  try {
    savedPins = localStorage.getItem(PIN_STORAGE_KEY)
  } catch {
    return {
      pins: DEFAULT_PINS,
      storageError: '저장된 핀을 불러오지 못했습니다. 브라우저 저장소 설정을 확인해 주세요.',
    }
  }

  if (savedPins === null) return { pins: DEFAULT_PINS, storageError: '' }

  let parsedPins
  try {
    parsedPins = JSON.parse(savedPins)
  } catch {
    return {
      pins: DEFAULT_PINS,
      storageError: '저장된 핀 데이터가 손상되어 기본 목록을 표시합니다.',
    }
  }

  if (!Array.isArray(parsedPins) || !parsedPins.every(isValidPin)) {
    return {
      pins: DEFAULT_PINS,
      storageError: '저장된 핀 데이터가 올바르지 않아 기본 목록을 표시합니다.',
    }
  }

  return { pins: parsedPins, storageError: '' }
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      if (event.originalEvent.target.closest('.leaflet-popup')) return
      onMapClick([event.latlng.lat, event.latlng.lng])
    },
  })

  return null
}

function App() {
  const [pinData, setPinData] = useState(loadPins)
  const pins = pinData.pins
  const [isSatellite, setIsSatellite] = useState(false)
  const [newPin, setNewPin] = useState(null)
  const [importMessage, setImportMessage] = useState('')
  const importFileInput = useRef(null)

  useEffect(() => {
    try {
      localStorage.setItem(PIN_STORAGE_KEY, JSON.stringify(pins))
    } catch {
      setPinData((current) => ({
        ...current,
        storageError: '핀을 브라우저에 저장하지 못했습니다. 저장 공간을 확인해 주세요.',
      }))
    }
  }, [pins])

  const updatePins = (update) => {
    setPinData((current) => ({
      ...current,
      storageError: '',
      pins: typeof update === 'function' ? update(current.pins) : update,
    }))
  }

  const exportPins = () => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `inter-map-pins-${timestamp}.json`
      const blob = new Blob(
        [`${JSON.stringify({ version: 1, pins }, null, 2)}\n`],
        { type: 'application/json' },
      )
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setImportMessage(`${filename} 파일을 다운로드했습니다.`)
    } catch (error) {
      setImportMessage(`JSON 내보내기에 실패했습니다: ${error.message}`)
    }
  }

  const importPins = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('파일이 너무 큽니다. 5MB 이하의 JSON 파일을 선택해 주세요.')
      }

      const importedData = JSON.parse(await file.text())

      const importedPins =
        importedData &&
        typeof importedData === 'object' &&
        importedData.version === 1 &&
        Array.isArray(importedData.pins)
          ? importedData.pins
          : null

      if (!importedPins || !importedPins.every(isValidPin)) {
        throw new Error('핀 JSON 형식이 올바르지 않습니다.')
      }

      const pinsWithNewIds = importedPins.map((pin) => ({
        ...pin,
        id: crypto.randomUUID(),
        category: pin.category ?? '기타',
      }))
      updatePins((currentPins) => [...currentPins, ...pinsWithNewIds])
      setImportMessage(`${file.name}에서 ${pinsWithNewIds.length}개의 핀을 추가했습니다.`)
    } catch (error) {
      setImportMessage(`JSON 가져오기에 실패했습니다: ${error.message}`)
    } finally {
      event.target.value = ''
    }
  }

  return (
    <div className="app-shell">
      <MapContainer
        center={[37.5665, 126.978]}
        zoom={11}
        scrollWheelZoom
        className="map"
      >
        <MapClickHandler
          onMapClick={(position) => {
            if (!newPin) setNewPin({ position, memo: '', category: '기타' })
          }}
        />

        <TileLayer
          key={isSatellite ? 'satellite' : 'street'}
          attribution={
            isSatellite
              ? 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
          url={
            isSatellite
              ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
              : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          }
        />

        {pins.map((pin) => (
          <Marker
            key={pin.id}
            position={pin.position}
            icon={PIN_ICONS[getPinCategory(pin.category).name]}
          >
            <Popup>
              <div className="pin-note">
                <span
                  className="pin-category-badge"
                  style={{ '--category-color': getPinCategory(pin.category).color }}
                >
                  {getPinCategory(pin.category).name}
                </span>
                {pin.name && <strong>{pin.name}</strong>}
                <p>{pin.memo ?? pin.name}</p>
              </div>
            </Popup>
          </Marker>
        ))}

        {newPin && (
          <Popup
            position={newPin.position}
            closeButton
            eventHandlers={{ remove: () => setNewPin(null) }}
          >
            <form
              className="pin-note-form"
              onSubmit={(event) => {
                event.preventDefault()
                const memo = newPin.memo.trim()
                if (!memo) return

                updatePins((currentPins) => [
                  ...currentPins,
                  {
                    id: crypto.randomUUID(),
                    position: newPin.position,
                    memo,
                    category: newPin.category,
                  },
                ])
                setNewPin(null)
              }}
            >
              <label htmlFor="pin-category">카테고리</label>
              <select
                id="pin-category"
                value={newPin.category}
                onChange={(event) =>
                  setNewPin((current) => ({ ...current, category: event.target.value }))
                }
              >
                {PIN_CATEGORIES.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name}
                  </option>
                ))}
              </select>
              <label htmlFor="pin-memo">이 위치의 메모</label>
              <textarea
                id="pin-memo"
                rows={3}
                maxLength={500}
                placeholder="이 장소에 대한 메모를 입력하세요."
                value={newPin.memo}
                onChange={(event) =>
                  setNewPin((current) => ({ ...current, memo: event.target.value }))
                }
                autoFocus
              />
              <div className="pin-note-actions">
                <span>{newPin.memo.length}/500</span>
                <div className="pin-note-buttons">
                  <button
                    type="button"
                    className="cancel-pin-button"
                    onClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setNewPin(null)
                    }}
                  >
                    취소
                  </button>
                  <button type="submit" disabled={!newPin.memo.trim()}>
                    메모와 핀 저장
                  </button>
                </div>
              </div>
            </form>
          </Popup>
        )}
      </MapContainer>

      <div className="map-overlay">
        <div className="map-sidebar">
          <div className="title-panel">
            <span className="eyebrow">Inter_Map</span>
            <h1>지도</h1>
          </div>

          <section className="pin-list-panel" aria-label="저장된 핀 목록">
            <h2>저장된 핀 <span>{pins.length}</span></h2>
            <div className="pin-data-actions">
              <button type="button" onClick={exportPins}>
                JSON 내보내기
              </button>
              <button type="button" onClick={() => importFileInput.current?.click()}>
                JSON 가져오기
              </button>
              <input
                ref={importFileInput}
                type="file"
                accept=".json,application/json"
                onChange={importPins}
                hidden
              />
            </div>
            {importMessage && (
              <p className="pin-import-message" role="status">{importMessage}</p>
            )}
            {pins.length === 0 ? (
              <p className="empty-pin-list">저장된 핀이 없습니다.</p>
            ) : (
              <div className="pin-category-groups">
                {PIN_CATEGORIES.map((category) => {
                  const categoryPins = pins.filter(
                    (pin) => getPinCategory(pin.category).name === category.name,
                  )
                  if (categoryPins.length === 0) return null

                  return (
                    <section className="pin-category-group" key={category.name}>
                      <h3>
                        <span
                          className="pin-list-marker"
                          style={{ '--category-color': category.color }}
                          aria-hidden="true"
                        />
                        {category.name}
                        <span className="pin-category-count">{categoryPins.length}</span>
                      </h3>
                      <ul className="pin-list">
                        {categoryPins.map((pin) => (
                          <li key={pin.id} className="pin-list-item">
                            <span className="pin-list-text">
                              <strong>{pin.name || category.name}</strong>
                              <span>{pin.memo || (pin.name ? '메모 없음' : '메모 핀')}</span>
                            </span>
                            <button
                              type="button"
                              className="delete-pin-button"
                              aria-label={`${pin.name || pin.memo || category.name} 삭제`}
                              onClick={() => updatePins((currentPins) =>
                                currentPins.filter((currentPin) => currentPin.id !== pin.id),
                              )}
                            >
                              삭제
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )
                })}
              </div>
            )}
            {pinData.storageError && (
              <p className="pin-storage-error" role="status">{pinData.storageError}</p>
            )}
          </section>
        </div>

        <p className="map-freshness-note">
          지도를 클릭해 메모 핀을 추가하세요. 일반 지도는 수시로 갱신되며, 위성 이미지의 촬영·갱신일은 지역마다 다릅니다.
        </p>

        <div className="map-actions">
          <button
            type="button"
            className="map-style-toggle"
            role="switch"
            aria-checked={isSatellite}
            onClick={() => setIsSatellite((current) => !current)}
          >
            <span>위성 이미지</span>
            <span className="toggle-track" aria-hidden="true">
              <span className="toggle-thumb" />
            </span>
          </button>
          <button
            type="button"
            className="clear-button"
            onClick={() => {
              if (window.confirm('모든 핀을 삭제할까요? 이 작업은 되돌릴 수 없습니다.')) {
                updatePins([])
              }
            }}
          >
            핀 지우기
          </button>
        </div>
      </div>
    </div>
  )
}

export default App
