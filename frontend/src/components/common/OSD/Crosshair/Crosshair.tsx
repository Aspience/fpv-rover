import './Crosshair.css'

export const Crosshair = () => {
  return (
    <div className="crosshair">
      <div className="crosshair__reticle">
        <span className="crosshair__line-v" />
        <span className="crosshair__line-h" />
        <span className="crosshair__dot" />
      </div>
    </div>
  )
}
