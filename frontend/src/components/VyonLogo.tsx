import vyonLogo from '../assets/vyon-logo.jpg'

type Props = {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export default function VyonLogo({ size = 'md', showText = true }: Props) {
  const sizes = {
    sm: { box: 'w-7 h-7', text: 'text-lg' },
    md: { box: 'w-10 h-10', text: 'text-2xl' },
    lg: { box: 'w-16 h-16', text: 'text-4xl' },
  }
  const s = sizes[size]

  return (
    <div className="flex items-center gap-3">
      <div className={`${s.box} rounded-2xl overflow-hidden shadow-vyon-glow flex items-center justify-center bg-white/5 border border-white/10`}>
        <img
          src={vyonLogo}
          alt="VYON Logo"
          className="w-full h-full object-cover"
        />
      </div>
      {showText && (
        <span className={`${s.text} font-black tracking-tight`}>
          VYON<span className="vyon-gradient-text">.</span>
        </span>
      )}
    </div>
  )
}
