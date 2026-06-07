"use client";

import { useState } from "react";
import {
  Copy,
  Eye,
  FileCode,
  HelpCircle,
  Loader2,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TEMPLATE_VARIABLES } from "@/lib/constants";
import {
  DEFAULT_TEMPLATE_FOOTER,
  DEFAULT_TEMPLATE_HEADER,
  DEFAULT_TEMPLATE_ROW,
} from "@/lib/constants";
import type { TemplatePart, TemplateSet } from "@/lib/types";

const initialTemplates: TemplateSet[] = [
  {
    id: "default",
    name: "Default",
    header: DEFAULT_TEMPLATE_HEADER,
    row: DEFAULT_TEMPLATE_ROW,
    footer: DEFAULT_TEMPLATE_FOOTER,
  },
];

const SAMPLE_DATA: Record<string, string> = {
  username: "guest_001",
  password: "xK9mP2",
  validity: "1 Hour",
  limitUptime: "01:00:00",
  limitBytesTotal: "1 GB",
  dnsName: "smartwifi.net",
  price: "10 AED",
  profile: "1 Hour",
  qrCode: "[QR Code]",
};

function renderPreview(template: string): string {
  return template.replace(/%(\w+)%/g, (_, key) => SAMPLE_DATA[key] ?? `%${key}%`);
}

export function TemplateEditorClient() {
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplates[0].id);
  const [activePart, setActivePart] = useState<TemplatePart>("row");
  const [templates, setTemplates] = useState(initialTemplates);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const current = templates.find((t) => t.id === selectedTemplate) ?? templates[0];
  const filePath = `/template/${current.id}.${activePart}.txt`;

  const updateContent = (part: TemplatePart, value: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === selectedTemplate ? { ...t, [part]: value } : t))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    toast.success(`Template saved: ${filePath}`);
    setSaving(false);
  };

  const insertVariable = (name: string) => {
    updateContent(activePart, `${current[activePart]}%${name}%`);
    toast.info(`Inserted %${name}%`);
  };

  const fullPreview = renderPreview(
    `${current.header}\n${current.row}\n${current.footer}`
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Template Editor"
        description="Customize voucher and receipt templates with dynamic placeholders."
      >
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="outline">
                <HelpCircle className="size-4" />
                Help
              </Button>
            }
          />
          <PopoverContent className="w-80" align="end">
            <p className="text-sm font-medium mb-2">Template Variables</p>
            <p className="text-xs text-muted-foreground mb-3">
              Use %variable% syntax. Click a variable below to insert it into the editor.
            </p>
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => insertVariable(v.name)}
                    className="flex w-full flex-col rounded-md border p-2 text-left hover:bg-muted"
                  >
                    <code className="text-xs font-mono text-primary">%{v.name}%</code>
                    <span className="text-xs text-muted-foreground">{v.description}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Select
            value={selectedTemplate}
            onValueChange={(v) => v && setSelectedTemplate(v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <code className="rounded-md bg-muted px-2 py-1 text-xs font-mono text-muted-foreground">
            {filePath}
          </code>
        </div>
        <Button
          variant={showPreview ? "default" : "outline"}
          onClick={() => setShowPreview(!showPreview)}
        >
          <Eye className="size-4" />
          {showPreview ? "Hide Preview" : "Preview"}
        </Button>
      </div>

      <div className={`grid gap-6 ${showPreview ? "lg:grid-cols-2" : ""}`}>
        <Card className="overflow-hidden">
          <Tabs
            value={activePart}
            onValueChange={(v) => setActivePart(v as TemplatePart)}
          >
            <CardHeader className="border-b py-3">
              <TabsList>
                <TabsTrigger value="header">
                  <FileCode className="size-3.5" />
                  Header
                </TabsTrigger>
                <TabsTrigger value="row">
                  <FileCode className="size-3.5" />
                  Row
                </TabsTrigger>
                <TabsTrigger value="footer">
                  <FileCode className="size-3.5" />
                  Footer
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="p-0">
              {(["header", "row", "footer"] as TemplatePart[]).map((part) => (
                <TabsContent key={part} value={part} className="m-0">
                  <Textarea
                    value={current[part]}
                    onChange={(e) => updateContent(part, e.target.value)}
                    className="min-h-[420px] resize-none rounded-none border-0 bg-zinc-950 font-mono text-sm text-zinc-100 focus-visible:ring-0 dark:bg-zinc-950"
                    spellCheck={false}
                  />
                </TabsContent>
              ))}
            </CardContent>
          </Tabs>
        </Card>

        {showPreview && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-base">Live Preview</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(fullPreview);
                  toast.success("Preview copied to clipboard");
                }}
              >
                <Copy className="size-3.5" />
                Copy
              </Button>
            </CardHeader>
            <CardContent>
              <div
                className="rounded-lg border bg-white p-4 text-black min-h-[420px] overflow-auto"
                dangerouslySetInnerHTML={{ __html: fullPreview }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
