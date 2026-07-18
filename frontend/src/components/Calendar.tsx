import { T } from '@/components/ColorPalette'
import { useState, useEffect } from 'react';

export const CalendarWidget = () => {

    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentDate(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <><div style={{
            backgroundColor: T.white, borderRadius: 24, padding: '24px',
            // boxShadow: '0 8px 8px rgba(14, 31, 31, 0.61)',
            border: `1px solid ${T.mutedCream}60`
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.inkPrimary }}>
                    Operations Calendar
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.teal, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {currentDate.toLocaleString('en-US', { month: 'long' })} {currentDate.getDate()}
                </span>
            </div>

            {/* Day Headings */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8, textAlign: 'center', marginBottom: 12 }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                    <span key={day} style={{ fontSize: 11, fontWeight: 700, color: T.inkGhost }}>{day}</span>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center' }}>
                {(() => {
                    const year = currentDate.getFullYear();
                    const month = currentDate.getMonth();

                    const firstDayOfMonth = new Date(year, month, 1);
                    const startOffset = firstDayOfMonth.getDay();

                    const daysInMonth = new Date(year, month + 1, 0).getDate();

                    const totalCells = 42;
                    return Array.from({ length: totalCells }).map((_, cellIdx) => {
                        const dayNum = cellIdx - startOffset + 1;
                        const isInCurrentMonth = dayNum >= 1 && dayNum <= daysInMonth;

                        const isCurrentSystemDay = isInCurrentMonth && dayNum === currentDate.getDate();
                        const hasDispatchesAwaiting = isInCurrentMonth && (dayNum === 12 || dayNum === 19 || dayNum === 26);

                        return (
                            <div key={cellIdx} style={{
                                height: 36,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 10,
                                position: 'relative',
                                cursor: 'pointer',
                                backgroundColor: isCurrentSystemDay ? T.teal : 'transparent',
                                color: isCurrentSystemDay ? T.white : isInCurrentMonth ? T.inkPrimary : 'transparent',
                                fontWeight: isCurrentSystemDay || hasDispatchesAwaiting ? 700 : 500,
                                fontSize: 13
                            }}>
                                {isInCurrentMonth ? dayNum : ''}
                                {hasDispatchesAwaiting && !isCurrentSystemDay && (
                                    <span style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: T.orange, position: 'absolute', bottom: 4 }} />
                                )}
                            </div>
                        );
                    });
                })()}
            </div>
        </div>
        </>
    )
}