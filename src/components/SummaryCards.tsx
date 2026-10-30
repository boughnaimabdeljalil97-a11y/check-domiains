import React from 'react';
import { Globe, Lock, Layers, ShieldCheck, Database } from 'lucide-react';
import { CheckerSummary } from '../types/domain';

interface SummaryCardsProps {
  summary: CheckerSummary;
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  summary,
  activeFilter,
  onSelectFilter,
}) => {
  const { total, sslYes, sslNo, websiteYes, websiteNo, bothYes } = summary;

  const sslPercent = total > 0 ? Math.round((sslYes / total) * 100) : 0;
  const webPercent = total > 0 ? Math.round((websiteYes / total) * 100) : 0;
  const bothPercent = total > 0 ? Math.round((bothYes / total) * 100) : 0;

  const cards = [
    {
      id: 'all',
      title: 'Total Domains',
      count: total,
      subtext: `${summary.completed} checked, ${summary.pending + summary.checking} pending`,
      icon: Layers,
      iconColor: 'text-slate-700 bg-slate-100',
      activeRing: 'ring-2 ring-slate-900 border-slate-900',
    },
    {
      id: 'ssl-yes',
      title: 'SSL = yes',
      count: sslYes,
      subtext: `${sslPercent}% valid • ${sslNo} without SSL`,
      icon: Lock,
      iconColor: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
      activeRing: 'ring-2 ring-emerald-600 border-emerald-600',
    },
    {
      id: 'website-yes',
      title: 'Website = yes',
      count: websiteYes,
      subtext: `${webPercent}% live & verified • ${websiteNo} offline/error`,
      icon: Globe,
      iconColor: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
      activeRing: 'ring-2 ring-emerald-600 border-emerald-600',
    },
    {
      id: 'both-yes',
      title: 'SSL & Website = yes',
      count: bothYes,
      subtext: `${bothPercent}% fully functional`,
      icon: ShieldCheck,
      iconColor: 'text-indigo-700 bg-indigo-50 border border-indigo-200',
      activeRing: 'ring-2 ring-indigo-600 border-indigo-600',
    },
    {
      id: 'whois-found',
      title: 'WHOIS Data Found',
      count: summary.whoisFound,
      subtext: `${total ? Math.round((summary.whoisFound / total) * 100) : 0}% have RDAP dates`,
      icon: Database,
      iconColor: 'text-purple-700 bg-purple-50 border border-purple-200',
      activeRing: 'ring-2 ring-purple-600 border-purple-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = activeFilter === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectFilter(isSelected && card.id !== 'all' ? 'all' : card.id)}
            className={`text-left bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer group ${
              isSelected ? card.activeRing : 'hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-600 group-hover:text-slate-900">
                {card.title}
              </span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${card.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="flex items-baseline space-x-2">
              <span className="text-2xl font-extrabold text-slate-900 tracking-tight font-mono">
                {card.count}
              </span>
              {card.id !== 'all' && total > 0 && (
                <span className="text-xs text-slate-400 font-mono">
                  / {total}
                </span>
              )}
            </div>

            <p className="text-[11px] text-slate-500 mt-1 truncate">
              {card.subtext}
            </p>
          </button>
        );
      })}
    </div>
  );
};
