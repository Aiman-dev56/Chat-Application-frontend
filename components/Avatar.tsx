interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  isOnline?: boolean;
}

const colors = [
  ['#7c6af7', '#f767a0'],
  ['#f767a0', '#ff9a5c'],
  ['#3df5a0', '#7c6af7'],
  ['#ff9a5c', '#f767a0'],
  ['#6af7d4', '#7c6af7'],
];

function getColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[hash % colors.length];
}

export default function Avatar({ name, src, size = 40, isOnline }: AvatarProps) {
  const initial = name?.charAt(0).toUpperCase() || '?';
  const [c1, c2] = getColor(name || '');

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%', overflow: 'hidden',
        background: `linear-gradient(135deg, ${c1}, ${c2})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.38, fontWeight: 700, fontFamily: 'Syne',
        color: 'white', flexShrink: 0,
      }}>
        {src ? (
          <img src={src} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : initial}
      </div>
      {isOnline !== undefined && (
        <div style={{
          position: 'absolute', bottom: 1, right: 1,
          width: size * 0.28, height: size * 0.28, borderRadius: '50%',
          background: isOnline ? 'var(--green)' : 'var(--text-muted)',
          border: '2px solid var(--bg-card)',
          boxShadow: isOnline ? '0 0 6px rgba(61,245,160,0.6)' : 'none',
        }} />
      )}
    </div>
  );
}
