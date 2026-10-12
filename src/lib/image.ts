/** Reads an image file and downsizes it to a square data URL so it fits in localStorage. */
export const fileToAvatar = (file: File, size = 160): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const c = document.createElement('canvas')
        c.width = c.height = size
        const ctx = c.getContext('2d')!
        const s = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size)
        resolve(c.toDataURL('image/webp', 0.85))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })

/** For video uploads we grab the first frame as the avatar. */
export const videoToAvatar = (file: File, size = 256): Promise<string> =>
  new Promise((resolve, reject) => {
    const v = document.createElement('video')
    v.muted = true
    v.preload = 'auto'
    v.src = URL.createObjectURL(file)
    v.onerror = reject
    v.onloadeddata = () => {
      v.currentTime = 0.1
    }
    v.onseeked = () => {
      const c = document.createElement('canvas')
      c.width = c.height = size
      const s = Math.min(v.videoWidth, v.videoHeight)
      c.getContext('2d')!.drawImage(v, (v.videoWidth - s) / 2, (v.videoHeight - s) / 2, s, s, 0, 0, size, size)
      URL.revokeObjectURL(v.src)
      resolve(c.toDataURL('image/webp', 0.85))
    }
  })
