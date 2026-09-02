import { MockTask } from '../data/mockData'
import { Calendar, User, Flag, FolderOpen } from 'lucide-react'

const priorityStyles: Record<string, string> = {
  high: 'bg-red-500/15 text-red-400 border-red-500/30',
  medium: 'bg-vyon-yellow/15 text-vyon-yellow border-vyon-yellow/30',
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
}

const priorityLabel: Record<string, string> = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
}

export default function TaskCard({ task }: { task: MockTask }) {
  return (
    <article className="vyon-task-card group">
      {/* Project badge */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 text-xs text-white/50">
          <FolderOpen className="w-3.5 h-3.5" />
          {task.project}
        </div>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${priorityStyles[task.priority]}`}
        >
          <Flag className="w-3 h-3 inline -mt-0.5 mr-1" />
          {priorityLabel[task.priority]}
        </span>
      </div>

      {/* Title */}
      <h4 className="font-bold text-[15px] mb-2 group-hover:text-vyon-yellow transition line-clamp-2">
        {task.title}
      </h4>

      {/* Desc */}
      <p className="text-sm text-white/50 mb-4 line-clamp-2">{task.description}</p>

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {task.tags.map(t => (
            <span
              key={t}
              className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 text-white/60 border border-white/5"
            >
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs text-white/50">
          <Calendar className="w-3.5 h-3.5" />
          {task.dueDate}
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full bg-vyon-gradient text-vyon-dark text-[11px] font-bold flex items-center justify-center shadow-vyon-glow"
            title={task.assignee}
          >
            {task.avatar}
          </div>
        </div>
      </div>
    </article>
  )
}
