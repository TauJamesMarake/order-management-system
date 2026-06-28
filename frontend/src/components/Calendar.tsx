import { T } from '@/components/ColorPalette'

export const CalendarWidget = () => {
    return (
        <><div style={{
            backgroundColor: T.white, borderRadius: 24, padding: '24px',
            boxShadow: '0 8px 8px rgba(14, 31, 31, 0.61)', border: `1px solid ${T.mutedCream}60`
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.inkPrimary }}>Operations Calendar</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.teal, textTransform: 'uppercase', letterSpacing: '0.04em' }}>June 2026</span>
            </div>

            {/* Day Headings Grid Array */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, textAlign: 'center', marginBottom: 12 }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                    <span key={day} style={{ fontSize: 11, fontWeight: 700, color: T.inkGhost }}>{day}</span>
                ))}
            </div>

            {/* Calendar Dynamic Day Structure Matrix (Aligned with current system context June 9, 2026) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center' }}>
                {/* Visual alignment padding cell placeholders */}
                {Array.from({ length: 1 }).map((_, i) => <span key={i} />)}
                {Array.from({ length: 30 }).map((_, idx) => {
                    const calendarDayNum = idx + 1
                    const isCurrentSystemDay = calendarDayNum === 9 // Today is June 9, 2026
                    const hasDispatchesAwaiting = calendarDayNum === 12 || calendarDayNum === 19 || calendarDayNum === 26

                    return (
                        <div key={idx} style={{
                            height: 36, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 10, position: 'relative', cursor: 'pointer',
                            backgroundColor: isCurrentSystemDay ? T.teal : 'transparent',
                            color: isCurrentSystemDay ? T.white : T.inkPrimary,
                            fontWeight: isCurrentSystemDay || hasDispatchesAwaiting ? 700 : 500, fontSize: 13
                        }}>
                            {calendarDayNum}
                            {hasDispatchesAwaiting && !isCurrentSystemDay && (
                                <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: T.orange, position: 'absolute', bottom: 4 }} />
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
        </>
    )
}