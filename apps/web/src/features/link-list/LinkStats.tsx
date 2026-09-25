import { Card } from '@/shared/components/Card';
import type { Link } from '@/entities/link/types';
import { useTranslation } from '@/shared/i18n';
import { Link2, MousePointerClick, CheckCircle2, TrendingUp } from 'lucide-react';

interface LinkStatsProps {
  links: Link[];
}

export function LinkStats({ links }: LinkStatsProps) {
  const { t } = useTranslation();
  const totalLinks = links.length;
  const totalClicks = links.reduce((acc, curr) => acc + curr.clicks, 0);
  const activeLinks = links.filter((l) => l.is_active).length;
  const avgClicks = totalLinks > 0 ? (totalClicks / totalLinks).toFixed(1) : '0';

  const stats = [
    {
      title: t.stats.totalLinks,
      value: totalLinks,
      icon: <Link2 className="w-5 h-5 avari-gold" />,
      bg: 'avari-raised',
    },
    {
      title: t.stats.totalClicks,
      value: totalClicks,
      icon: <MousePointerClick className="w-5 h-5 text-[var(--av-success)]" />,
      bg: 'avari-raised',
    },
    {
      title: t.stats.activeLinks,
      value: activeLinks,
      icon: <CheckCircle2 className="w-5 h-5 avari-cyan" />,
      bg: 'avari-raised',
    },
    {
      title: t.stats.avgPerLink,
      value: avgClicks,
      icon: <TrendingUp className="w-5 h-5 avari-gold" />,
      bg: 'avari-raised',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <Card key={i} className="flex items-center gap-4 p-4">
          <div className={`p-3 rounded-xl ${stat.bg}`}>{stat.icon}</div>
          <div>
            <p className="text-xs font-medium avari-muted">
              {stat.title}
            </p>
            <p className="font-mono text-xl font-medium">
              {stat.value}
            </p>
          </div>
        </Card>
      ))}
    </div>
  );
}
