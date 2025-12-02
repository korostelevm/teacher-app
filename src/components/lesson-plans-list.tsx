"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { BookOpen, Clock, GraduationCap } from "lucide-react";

interface LessonPlan {
  id: string;
  title: string;
  gradeLevel: number;
  subject: string;
  status: "draft" | "published" | "archived";
  standards: string[];
  objectives: string[];
  durationMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

interface LessonPlansListProps {
  onSelectLessonPlan: (lessonPlanId: string) => void;
  selectedLessonPlanId: string | null;
}

const statusColors = {
  draft: "bg-amber-500/20 text-amber-300 border-amber-500/30",
  published: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  archived: "bg-slate-500/20 text-slate-400 border-slate-500/30",
};

export function LessonPlansList({ onSelectLessonPlan, selectedLessonPlanId }: LessonPlansListProps) {
  const [lessonPlans, setLessonPlans] = useState<LessonPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLessonPlans = async () => {
      try {
        const response = await fetch("/api/lesson-plans");
        const data = await response.json();
        setLessonPlans(data.lessonPlans || []);
      } catch (error) {
        console.error("Failed to fetch lesson plans:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLessonPlans();
  }, []);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading lesson plans...</div>;
  }

  return (
    <div className="p-4 space-y-2">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-violet-400" />
        Lesson Plans
      </h2>
      {lessonPlans.length === 0 ? (
        <div className="text-center py-8">
          <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">No lesson plans yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Start a chat to create your first lesson plan
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {lessonPlans.map((plan) => (
            <Card
              key={plan.id}
              onClick={() => onSelectLessonPlan(plan.id)}
              className={`p-3 cursor-pointer transition-all ${
                selectedLessonPlanId === plan.id
                  ? "bg-violet-600/20 border-violet-500/50 ring-1 ring-violet-500/30"
                  : "hover:bg-accent hover:border-accent"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-medium text-sm truncate flex-1">{plan.title}</div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColors[plan.status]}`}>
                  {plan.status}
                </span>
              </div>
              
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <GraduationCap className="h-3 w-3" />
                  <span>Grade {plan.gradeLevel}</span>
                </div>
                {plan.durationMinutes && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{plan.durationMinutes}m</span>
                  </div>
                )}
              </div>

              {plan.standards.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {plan.standards.slice(0, 2).map((std) => (
                    <span
                      key={std}
                      className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 rounded text-slate-300"
                    >
                      {std}
                    </span>
                  ))}
                  {plan.standards.length > 2 && (
                    <span className="text-[10px] px-1.5 py-0.5 text-slate-400">
                      +{plan.standards.length - 2} more
                    </span>
                  )}
                </div>
              )}

              <div className="text-[10px] text-muted-foreground/60 mt-2">
                Updated {new Date(plan.updatedAt).toLocaleDateString()}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

