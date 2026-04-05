"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Globe,
  Lock,
  Shield,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { BreadcrumbNav } from "@/components/breadcrumb-nav";
import { FinancialOverviewCard } from "@/components/field-ops/financial-overview-card";
import { apiFetch } from "@/lib/api-client";

interface ServiceSummary {
  id: string;
  name: string;
  status: string;
  riskLevel: string;
}

interface VaultStatus {
  initialized: boolean;
  locked: boolean;
  credentialCount: number;
}

interface SafetyStatus {
  circuitBreakerTripped: boolean;
  emergencyStopActive: boolean;
  globalSpendLimit: number | null;
  totalSpentToday: number;
}

export default function ConnectionsOverviewPage() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<ServiceSummary[]>([]);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [servicesRes, vaultRes, safetyRes] = await Promise.all([
        apiFetch("/api/field-ops/services"),
        apiFetch("/api/field-ops/vault/status"),
        apiFetch("/api/field-ops/safety"),
      ]);

      if (servicesRes.ok) {
        const data = await servicesRes.json();
        const allServices: ServiceSummary[] = data.services ?? data.data ?? [];
        setServices(allServices);
      }
      if (vaultRes.ok) {
        const data = await vaultRes.json();
        setVaultStatus(data.vault ?? data ?? null);
      }
      if (safetyRes.ok) {
        const data = await safetyRes.json();
        setSafetyStatus(data.safety ?? data ?? null);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const connectedServices = services.filter((s) => s.status === "connected");
  const savedServices = services.filter((s) => s.status === "saved");
  const errorServices = services.filter((s) => s.status === "error" || s.status === "disconnected");

  if (loading) {
    return (
      <div className="space-y-6">
        <BreadcrumbNav items={[{ label: "Connections" }]} />
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const hasAlerts = errorServices.length > 0 ||
    safetyStatus?.circuitBreakerTripped ||
    safetyStatus?.emergencyStopActive;

  return (
    <div className="space-y-6">
      <BreadcrumbNav items={[{ label: "Connections" }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connections</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Services, vault, and safety status</p>
        </div>
        {hasAlerts && (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" />
            Needs attention
          </Badge>
        )}
      </div>

      {/* Status Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Services */}
        <Link href="/field-ops/services" className="block group">
          <Card className="h-full transition-all hover:border-primary/30 cursor-pointer">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Services
                </span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </CardDescription>
              <CardTitle className="text-2xl">{connectedServices.length}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {connectedServices.length > 0 ? (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <Wifi className="h-3 w-3" />
                  <span>{connectedServices.length} connected</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <WifiOff className="h-3 w-3" />
                  <span>None connected</span>
                </div>
              )}
              {savedServices.length > 0 && (
                <p className="text-xs text-muted-foreground">+{savedServices.length} saved</p>
              )}
              {errorServices.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span>{errorServices.length} error</span>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>

        {/* Vault */}
        <Link href="/field-ops/vault" className="block group">
          <Card className={`h-full transition-all hover:border-primary/30 cursor-pointer ${
            vaultStatus?.initialized && !vaultStatus.locked ? "border-emerald-500/20" : ""
          }`}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" />
                  Vault
                </span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </CardDescription>
              <CardTitle className="text-2xl">
                {vaultStatus?.credentialCount ?? 0}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {!vaultStatus?.initialized ? (
                <p className="text-xs text-muted-foreground">Not initialized</p>
              ) : vaultStatus.locked ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                  <Lock className="h-3 w-3" />
                  <span>Locked</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>Unlocked</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {vaultStatus?.credentialCount ?? 0} credential{(vaultStatus?.credentialCount ?? 0) !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
        </Link>

        {/* Safety */}
        <Link href="/field-ops/safety" className="block group">
          <Card className={`h-full transition-all hover:border-primary/30 cursor-pointer ${
            safetyStatus?.circuitBreakerTripped || safetyStatus?.emergencyStopActive
              ? "border-red-500/30"
              : "border-emerald-500/20"
          }`}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Safety
                </span>
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
              </CardDescription>
              <CardTitle className="text-lg">
                {safetyStatus?.circuitBreakerTripped || safetyStatus?.emergencyStopActive
                  ? "Alert"
                  : "OK"}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1">
              {safetyStatus?.emergencyStopActive ? (
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <XCircle className="h-3 w-3" />
                  <span>Emergency stop active</span>
                </div>
              ) : safetyStatus?.circuitBreakerTripped ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Circuit breaker tripped</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>All systems normal</span>
                </div>
              )}
              {safetyStatus?.globalSpendLimit != null && (
                <p className="text-xs text-muted-foreground">
                  ${safetyStatus.totalSpentToday.toFixed(2)} / ${safetyStatus.globalSpendLimit} today
                </p>
              )}
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Financial Overview */}
      <FinancialOverviewCard variant="detailed" />

      {/* Connected Services List */}
      {connectedServices.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Wifi className="h-4 w-4 text-emerald-400" />
                Connected Services
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                <Link href="/field-ops/services">Manage →</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {connectedServices.map((svc) => (
                <Badge
                  key={svc.id}
                  variant="outline"
                  className="gap-1.5 text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {svc.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/field-ops/services">
          <Card className="transition-all hover:border-primary/30 cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Services</p>
                <p className="text-xs text-muted-foreground">Browse &amp; connect integrations</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/field-ops/vault">
          <Card className="transition-all hover:border-primary/30 cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Vault</p>
                <p className="text-xs text-muted-foreground">Encrypted credential storage</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/field-ops/safety">
          <Card className="transition-all hover:border-primary/30 cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Safety</p>
                <p className="text-xs text-muted-foreground">Spend limits &amp; circuit breakers</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
