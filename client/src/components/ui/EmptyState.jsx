import { Link } from 'react-router-dom';

export default function EmptyState({ icon: Icon, iconClass = 'text-gray-200', title, description, actionLabel, actionHref }) {
  return (
    <div className="text-center py-20">
      {Icon && <Icon size={64} className={`mx-auto mb-4 ${iconClass}`} />}
      <h2 className="text-xl font-semibold text-gray-500 mb-2">{title}</h2>
      {description && <p className="text-gray-400 mb-6">{description}</p>}
      {actionLabel && actionHref && (
        <Link to={actionHref} className="btn-primary inline-block">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
