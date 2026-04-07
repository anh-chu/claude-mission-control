"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Rocket,
  Lock,
  Zap,
  CheckCircle2,
  Flag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { VaultSetupWizard } from "@/components/vault-setup-wizard";


const STORAGE_KEY = "mc-onboarded";

// ─── Step types ─────────────────────────────────────────────────────────────

type StepType = "bullets" | "vault-setup" | "data-management" | "ready";

interface BaseStep {
  icon: typeof Rocket;
  title: string;
  description: string;
  type: StepType;
}

interface BulletsStep extends BaseStep {
  type: "bullets";
  bullets: string[];
}

interface SpecialStep extends BaseStep {
  type: "vault-setup" | "data-management" | "ready";
}

type Step = BulletsStep | SpecialStep;

const steps: Step[] = [
  {
    type: "bullets",
    icon: Rocket,
    title: "Welcome to Task Control",
    description:
      "Your AI-powered task orchestration hub. Organize work, delegate to agents, and execute real actions across services.",
    bullets: [
      "Prioritize with the Eisenhower Matrix (Do, Schedule, Delegate, Eliminate)",
      "Track progress with Kanban boards and goal milestones",
      "Delegate to specialized AI agents (Researcher, Developer, Marketer, etc.)",
      "Execute real actions via Integrations — social posts, transactions, API calls",
    ],
  },
  {
    type: "vault-setup",
    icon: Lock,
    title: "Secure Your Vault",
    description:
      "Set a master password to encrypt your API keys and tokens. Your agents need credentials to execute tasks on your behalf.",
  },
  {
    type: "data-management",
    icon: Flag,
    title: "Your Data, Your Control",
    description:
      "Everything is stored locally as JSON files — no cloud, no accounts. You have full control over your data.",
  },
  {
    type: "ready",
    icon: Zap,
    title: "You're All Set!",
    description:
      "Task Control is ready. Here are some tips to get started.",
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function OnboardingDialog() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [vaultDone, setVaultDone] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    setOpen(false);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleClose();
    }
  };

  const current = steps[step];
  const Icon = current.icon;

  // ─── Render step-specific content ───────────────────────────────────────

  function renderStepContent() {
    switch (current.type) {
      case "bullets":
        return (
          <ul className="space-y-2 py-2">
            {(current as BulletsStep).bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="text-primary mt-1 shrink-0">&bull;</span>
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
        );

      case "vault-setup":
        if (vaultDone) {
          return (
            <div className="text-center py-4 space-y-2">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto" />
              <p className="text-sm font-medium">Vault Initialized</p>
              <p className="text-xs text-muted-foreground">
                You can now store API keys and tokens securely.
              </p>
            </div>
          );
        }
        return (
          <div className="py-2">
            <VaultSetupWizard
              compact
              onComplete={() => {
                setVaultDone(true);
                setTimeout(() => handleNext(), 1000);
              }}
              onSkip={handleNext}
            />
          </div>
        );

      case "data-management":
        return (
          <ul className="space-y-2 py-2">
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-1 shrink-0">&bull;</span>
              <span>
                Use{" "}
                <Link
                  href="/checkpoints"
                  className="text-primary hover:underline"
                  onClick={handleClose}
                >
                  Checkpoints
                </Link>{" "}
                to save, restore, or export your workspace at any time
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-1 shrink-0">&bull;</span>
              <span>
                Export your workspace as JSON for backup or portability
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-1 shrink-0">&bull;</span>
              <span>
                All data files live in{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">
                  ~/.cmc/
                </code>
              </span>
            </li>
          </ul>
        );

      case "ready":
        return (
          <ul className="space-y-2 py-2">
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-1 shrink-0">&bull;</span>
              <span>
                Press{" "}
                <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  Ctrl+K
                </kbd>{" "}
                to open the command palette
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-1 shrink-0">&bull;</span>
              <span>
                Press{" "}
                <kbd className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  ?
                </kbd>{" "}
                to see all keyboard shortcuts
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-1 shrink-0">&bull;</span>
              <span>
                Read the full{" "}
                <Link
                  href="/guide"
                  className="text-primary hover:underline"
                  onClick={handleClose}
                >
                  Guide
                </Link>{" "}
                for a complete walkthrough of all features
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-1 shrink-0">&bull;</span>
              <span>
                Ctrl+Click tasks to multi-select for bulk actions
              </span>
            </li>
          </ul>
        );
    }
  }

  // ─── Determine if we should show Next/Skip in the footer ────────────────
  // Some steps (vault-setup, demo-data) have their own navigation built in
  const showFooterNav =
    current.type === "bullets" ||
    current.type === "data-management" ||
    current.type === "ready" ||
    (current.type === "vault-setup" && vaultDone);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          const currentType = steps[step]?.type;
          if (currentType === "vault-setup") {
            // Don't close during interactive steps
            return;
          }
          handleClose();
        }
      }}
    >
      <DialogContent
        className="max-w-md"
        onPointerDownOutside={(e) => {
          // Prevent accidental close during interactive steps
          const currentType = steps[step]?.type;
          if (currentType === "vault-setup") {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          const currentType = steps[step]?.type;
          if (currentType === "vault-setup") {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>{current.title}</DialogTitle>
              <DialogDescription className="mt-0.5">
                {current.description}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {renderStepContent()}

        <div className="flex items-center justify-between pt-2 border-t">
          {/* Step indicators */}
          <div className="flex gap-1.5">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 w-6 rounded-full transition-colors ${
                  i === step ? "bg-primary" : i < step ? "bg-primary/40" : "bg-muted"
                }`}
              />
            ))}
          </div>

          {showFooterNav && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Skip
              </Button>
              <Button size="sm" onClick={handleNext}>
                {step < steps.length - 1 ? "Next" : "Get Started"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
