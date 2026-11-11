"use client";

import AppHeader from "@/components/ui/AppHeader";
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Card,
  Chip,
  CodeInput,
  EmptyState,
  Input,
  Modal,
  SegmentedControl,
  Skeleton,
  Sticker,
  Tabs,
  TimerBar,
  ToastProvider,
} from "@/components/ui";
import { useState } from "react";

const DEMO_NOW = 0;
const DEMO_ENDS_AT = 24_000;

function Kit({ theme }: { theme: "light" | "dark" }) {
  const [code, setCode] = useState("LOREX");
  const [tab, setTab] = useState<"groups" | "activity">("groups");
  const [mode, setMode] = useState<"classic" | "quick">("classic");
  const [open, setOpen] = useState(false);
  return (
    <section data-theme={theme} className="rounded-[8px] border-[3px] border-border bg-bg p-4 text-ink shadow-hard-md sm:p-7">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold uppercase">{theme} theme</h2>
        <Badge tone="accent">{theme}</Badge>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-4">
          <p className="label mb-3">Buttons</p>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </div>
        </Card>
        <Card className="p-4">
          <p className="label mb-3">Inputs and code</p>
          <Input label="Display name" placeholder="Alex" hint="This is visible to your group." />
          <div className="mt-4">
            <CodeInput value={code} onChange={setCode} />
          </div>
          <Input label="Invalid field" error="That code is not open." className="mt-4" />
        </Card>
        <Card className="p-4">
          <p className="label mb-3">Chips and badges</p>
          <div className="flex flex-wrap gap-2">
            <Chip active>Active</Chip>
            <Chip>Filter</Chip>
            <Badge>Neutral</Badge>
            <Badge tone="primary">Primary</Badge>
            <Badge tone="success">Success</Badge>
            <Badge tone="danger">Danger</Badge>
            <Sticker>Winner</Sticker>
          </div>
          <div className="mt-5 flex items-center gap-3">
            <Avatar name="Alex Rivera" host />
            <Avatar name="Sam" size="lg" />
            <AvatarStack people={[{ name: "Alex" }, { name: "Sam" }, { name: "Jo" }, { name: "Kai" }, { name: "Mia" }, { name: "Noah" }]} />
          </div>
        </Card>
        <Card className="p-4">
          <p className="label mb-3">Controls</p>
          <Tabs value={tab} onChange={setTab} tabs={[{ value: "groups", label: "Groups" }, { value: "activity", label: "Activity" }]} />
          <div className="mt-4">
            <SegmentedControl label="Mode" value={mode} onChange={setMode} options={[{ value: "classic", label: "Classic", description: "Full round set." }, { value: "quick", label: "Quick", description: "Short and sharp." }]} />
          </div>
          <Button className="mt-4" onClick={() => setOpen(true)}>Open modal</Button>
        </Card>
        <Card className="p-4">
          <p className="label mb-3">Timer and skeleton</p>
          <TimerBar endsAt={DEMO_ENDS_AT} serverNow={DEMO_NOW} />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
          </div>
        </Card>
        <Card className="p-4">
          <p className="label mb-3">Empty state</p>
          <EmptyState emoji="👥" title="No groups yet" description="Create one and invite your people." action={<Button size="sm">New group</Button>} />
        </Card>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Modal / sheet">
        <p className="text-sm text-muted">The same dialog becomes a bottom sheet on mobile and an 8px card on desktop.</p>
        <Button className="mt-4 w-full" onClick={() => setOpen(false)}>Got it</Button>
      </Modal>
    </section>
  );
}

export default function UiKitPage() {
  return (
    <main className="min-h-screen">
      <AppHeader />
      <div className="mx-auto w-full max-w-[1120px] px-4 py-8 sm:px-6">
        <p className="label text-primary">Kitchen sink</p>
        <h1 className="mt-2 font-display text-4xl font-bold uppercase tracking-[-0.04em] sm:text-6xl">GroupLore UI kit</h1>
        <p className="mt-3 max-w-2xl text-base text-muted">Every primitive in both token sets. The theme toggle in the header controls the app; these panels are forced to show each theme together.</p>
        <div className="mt-8 grid gap-6">
          <ToastProvider><Kit theme="light" /></ToastProvider>
          <ToastProvider><Kit theme="dark" /></ToastProvider>
        </div>
      </div>
    </main>
  );
}
