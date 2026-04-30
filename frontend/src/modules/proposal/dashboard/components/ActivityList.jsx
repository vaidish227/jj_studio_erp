import React from 'react';
import { FilePlus, Send, CheckCircle, PenTool, Clock } from 'lucide-react';
import Card from '../../../../shared/components/Card/Card';

const ActivityList = ({ activities = [] }) => {
  const getIcon = (type) => {
    switch (type) {
      case 'created': return { icon: FilePlus, color: 'text-blue-500', bg: 'bg-blue-500/10' };
      case 'approved': return { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' };
      case 'sent': return { icon: Send, color: 'text-purple-500', bg: 'bg-purple-500/10' };
      case 'signed': return { icon: PenTool, color: 'text-orange-500', bg: 'bg-orange-500/10' };
      default: return { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-500/10' };
    }
  };

  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-[var(--text-primary)]">Recent Activity</h3>
        <button className="text-xs font-bold text-[var(--primary)] uppercase tracking-widest hover:underline">View All</button>
      </div>

      <div className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
        {activities.length > 0 ? (
          activities.map((activity, idx) => {
            const { icon: Icon, color, bg } = getIcon(activity.type);
            return (
              <div key={idx} className="flex gap-4 relative group">
                {idx < activities.length - 1 && (
                  <div className="absolute left-5 top-10 bottom-[-24px] w-0.5 bg-[var(--border)] group-last:hidden" />
                )}
                <div className={`w-10 h-10 rounded-xl ${bg} ${color} flex items-center justify-center shrink-0 z-10 border border-white/5 shadow-sm`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                    {activity.message}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      {activity.client}
                    </span>
                    <span className="w-1 h-1 rounded-full bg-[var(--border)]" />
                    <span className="text-[10px] text-[var(--text-muted)] uppercase font-medium">
                      {activity.time}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-10 opacity-20">
            <Clock size={40} />
            <p className="text-sm mt-2 font-medium">No activity recorded</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default ActivityList;
