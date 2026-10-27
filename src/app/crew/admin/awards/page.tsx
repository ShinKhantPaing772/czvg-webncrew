"use client";

import { useCallback, useEffect, useState } from "react";
import { Edit, ImageOff, Loader2, Plus, Star, Trash2 } from "lucide-react";
import Image from "next/image";

import { CrewHeader } from "@/components/crew-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { authFetch } from "@/lib/utils/api";

type Award = {
  id: number;
  name: string | null;
  description: string | null;
  imageurl: string | null;
  featured: number | null;
};
type AwardForm = { name: string; description: string; imageurl: string; featured: boolean };
const emptyForm: AwardForm = { name: "", description: "", imageurl: "", featured: false };

async function responseData(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || fallback);
  return data;
}

function editableString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function displayImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function isHttpsUrl(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("/")) return true;
  try {
    return new URL(trimmed).protocol === "https:";
  } catch {
    return false;
  }
}

export default function AdminAwardsPage() {
  const { t, locale } = useI18n();
  const [awards, setAwards] = useState<Award[]>([]);
  const [selected, setSelected] = useState<Award | null>(null);
  const [form, setForm] = useState<AwardForm>(emptyForm);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const loadAwards = useCallback(async () => {
    const response = await authFetch("/api/admin/awards");
    const data = await responseData(
      response,
      t("Failed to load awards", "加载勋章列表失败"),
    );
    setAwards(Array.isArray(data.awards) ? data.awards : []);
  }, [t]);

  useEffect(() => {
    loadAwards()
      .catch((loadError) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : t("Failed to load awards", "加载勋章列表失败"),
        ),
      )
      .finally(() => setLoading(false));
  }, [loadAwards, t]);

  function openAdd() {
    setSelected(null);
    setForm(emptyForm);
    setFormError("");
    setDialogOpen(true);
  }
  function openEdit(award: Award) {
    setSelected(award);
    setForm({
      name: editableString(award.name),
      description: editableString(award.description),
      imageurl: editableString(award.imageurl),
      featured: award.featured === 1,
    });
    setFormError("");
    setDialogOpen(true);
  }

  async function saveAward() {
    setSaving(true);
    setFormError("");
    try {
      const response = await authFetch("/api/admin/awards", {
        method: selected ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(selected ? { id: selected.id } : {}), ...form }),
      });
      await responseData(
        response,
        selected
          ? t("Failed to update award", "更新勋章失败")
          : t("Failed to create award", "创建勋章失败"),
      );
      await loadAwards();
      setDialogOpen(false);
    } catch (saveError) {
      setFormError(
        saveError instanceof Error
          ? saveError.message
          : t("Failed to save award", "保存勋章失败"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteAward(award: Award) {
    setDeletingId(award.id);
    setError("");
    try {
      const response = await authFetch(`/api/admin/awards?id=${award.id}`, {
        method: "DELETE",
      });
      await responseData(
        response,
        t("Failed to delete award", "删除勋章失败"),
      );
      await loadAwards();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : t("Failed to delete award", "删除勋章失败"),
      );
    } finally {
      setDeletingId(null);
    }
  }

  const imageUrlError =
    form.imageurl.trim() && !isHttpsUrl(form.imageurl)
      ? t(
          "Enter a valid HTTPS image URL. The existing HTTP image cannot be reused.",
          "请输入有效的 HTTPS 图片链接。不支持使用 HTTP 链接。",
        )
      : "";
  const canSave = Boolean(
    form.name.trim() &&
      form.description.trim() &&
      form.imageurl.trim() &&
      !imageUrlError,
  );

  return (
    <CrewHeader>
      <main className="flex-1 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("Awards", "荣誉勋章")}</h1>
            <p className="text-sm text-muted-foreground">
              {t(
                "Manage award definitions and the featured public reward.",
                "管理勋章定义及公开展示的特色表彰奖项。",
              )}
            </p>
          </div>
          <Button onClick={openAdd} disabled={loading}>
            <Plus className="mr-2 h-4 w-4" />
            {t("Add Award", "新增荣誉勋章")}
          </Button>
        </div>
        {error ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Award", "勋章")}</TableHead>
                  <TableHead className="hidden md:table-cell">
                    {t("Description", "描述")}
                  </TableHead>
                  <TableHead>{t("Public", "公开展示")}</TableHead>
                  <TableHead className="text-right">
                    {t("Actions", "操作")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : awards.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-muted-foreground"
                    >
                      {t("No awards found.", "未找到勋章。")}
                    </TableCell>
                  </TableRow>
                ) : (
                  awards.map((award) => {
                    const imageUrl = displayImageUrl(award.imageurl);
                    const awardName =
                      locale === "zh"
                        ? (award as any).name_zh ||
                          (award as any).nameZh ||
                          t(award.name || "", award.name || "") ||
                          t("Unnamed award", "未命名勋章")
                        : editableString(award.name) ||
                          t("Unnamed award", "未命名勋章");
                    const awardDesc =
                      locale === "zh"
                        ? (award as any).description_zh ||
                          (award as any).descriptionZh ||
                          t(award.description || "", award.description || "") ||
                          t("No description", "暂无说明")
                        : editableString(award.description) ||
                          t("No description", "暂无说明");
                    return (
                      <TableRow key={award.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            {imageUrl ? (
                              <Image
                                src={imageUrl}
                                alt=""
                                width={40}
                                height={40}
                                unoptimized
                                className="h-10 w-10 rounded-md border object-contain"
                              />
                            ) : (
                              <span className="flex h-10 w-10 items-center justify-center rounded-md border bg-muted">
                                <ImageOff className="h-4 w-4 text-muted-foreground" />
                              </span>
                            )}
                            <span className="font-medium">{awardName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden max-w-lg md:table-cell">
                          <p className="line-clamp-2 text-sm text-muted-foreground">
                            {awardDesc}
                          </p>
                        </TableCell>
                        <TableCell>
                          {award.featured === 1 ? (
                            <Badge>
                              <Star className="mr-1 h-3 w-3" />
                              {t("Featured", "特色展示")}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(award)}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">
                                {locale === "zh"
                                  ? `编辑 ${awardName}`
                                  : `Edit ${awardName}`}
                              </span>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  disabled={deletingId === award.id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">
                                    {locale === "zh"
                                      ? `删除 ${awardName}`
                                      : `Delete ${awardName}`}
                                  </span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {locale === "zh"
                                      ? `确认删除 ${awardName}？`
                                      : `Delete ${awardName}?`}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t(
                                      "This is allowed only when no aircraft or pilot grants reference the award.",
                                      "仅在无飞机配属要求且无飞行员持有时方可删除。",
                                    )}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    {t("Cancel", "取消")}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteAward(award)}
                                  >
                                    {t("Delete", "确认删除")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {selected
                  ? t("Edit Award", "编辑荣誉勋章")
                  : t("Add Award", "新增荣誉勋章")}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              {formError ? (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {formError}
                </div>
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="award-name">
                  {t("Name", "勋章名称")}
                </Label>
                <Input
                  id="award-name"
                  value={form.name}
                  onChange={(event) =>
                    setForm({ ...form, name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="award-description">
                  {t("Description", "勋章颁发说明")}
                </Label>
                <Textarea
                  id="award-description"
                  value={form.description}
                  onChange={(event) =>
                    setForm({ ...form, description: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="award-image">
                  {t("Image URL (HTTPS)", "勋章图标链接 (HTTPS)")}
                </Label>
                <Input
                  id="award-image"
                  type="url"
                  placeholder="https://..."
                  value={form.imageurl}
                  aria-invalid={Boolean(imageUrlError)}
                  aria-describedby={
                    imageUrlError ? "award-image-error" : undefined
                  }
                  onChange={(event) =>
                    setForm({ ...form, imageurl: event.target.value })
                  }
                />
                {imageUrlError ? (
                  <p id="award-image-error" className="text-sm text-destructive">
                    {imageUrlError}
                  </p>
                ) : null}
              </div>
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id="award-featured"
                  checked={form.featured}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, featured: checked === true })
                  }
                />
                <div>
                  <Label htmlFor="award-featured">
                    {t(
                      "Feature on public rank page",
                      "在公开职级页面展示",
                    )}
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t(
                      "Selecting this replaces the currently featured award.",
                      "选中此项将替换当前展示的特色勋章。",
                    )}
                  </p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                {t("Cancel", "取消")}
              </Button>
              <Button onClick={saveAward} disabled={!canSave || saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selected
                  ? t("Save Changes", "保存修改")
                  : t("Create Award", "创建勋章")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </CrewHeader>
  );
}
