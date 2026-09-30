"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PLATFORM_CHAR_LIMITS } from "@/lib/social-clients/constants.js";
import { isVideoMediaUrl } from "@/components/ui/media-preview-modal";
import {
  Eye,
  Share2,
  ThumbsUp,
  MessageCircle,
  Heart,
  Send,
  Bookmark,
  MoreHorizontal,
  Repeat2,
  BarChart2,
  Globe,
  Music2,
  Play,
} from "lucide-react";

function Avatar({ account, className = "h-9 w-9" }) {
  const logo = account?.platform?.logoUrl;
  if (logo) {
    return <img src={logo} alt="" className={`rounded-full object-cover ${className}`} />;
  }
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-gradient-to-br from-primary/70 to-primary text-primary-foreground text-sm font-bold ${className}`}
    >
      {(account?.account_name || "?").charAt(0).toUpperCase()}
    </span>
  );
}

function Media({ url, className = "" }) {
  if (isVideoMediaUrl(url)) {
    return (
      <span className={`relative block overflow-hidden bg-black ${className}`}>
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <Play className="h-8 w-8 text-white fill-white drop-shadow" />
        </span>
      </span>
    );
  }
  return <img src={url} alt="" className={`object-cover ${className}`} />;
}

function MediaGrid({ urls }) {
  if (!urls?.length) return null;
  if (urls.length === 1) {
    return <Media url={urls[0]} className="w-full aspect-video" />;
  }
  const shown = urls.slice(0, 4);
  const extra = urls.length - shown.length;
  return (
    <div className="grid grid-cols-2 gap-0.5">
      {shown.map((url, i) => (
        <span key={url + i} className="relative">
          <Media url={url} className="w-full aspect-square" />
          {extra > 0 && i === shown.length - 1 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-lg font-semibold">
              +{extra}
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

function TagText({ hashtags, className = "text-[#385898]" }) {
  if (!hashtags?.length) return null;
  return (
    <span className={className}> {hashtags.map((t) => `#${t}`).join(" ")}</span>
  );
}

function FacebookPreview({ account, content, hashtags, mediaUrls }) {
  return (
    <div className="rounded-lg border bg-white text-gray-900 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 p-3">
        <Avatar account={account} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{account.account_name}</p>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            Just now · <Globe className="h-3 w-3" />
          </p>
        </div>
        <MoreHorizontal className="h-4 w-4 text-gray-500 flex-shrink-0" />
      </div>
      {content || hashtags.length > 0 ? (
        <p className="px-3 pb-3 text-sm whitespace-pre-wrap break-words">
          {content}
          <TagText hashtags={hashtags} />
        </p>
      ) : null}
      {mediaUrls.length > 0 && <MediaGrid urls={mediaUrls} />}
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-500">
            <ThumbsUp className="h-2.5 w-2.5 text-white fill-white" />
          </span>
          12
        </span>
        <span>3 comments · 1 share</span>
      </div>
      <div className="grid grid-cols-3 border-t mx-3 text-gray-600">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Share2, label: "Share" },
        ].map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium"
          >
            <Icon className="h-4 w-4" /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function InstagramPreview({ account, content, hashtags, mediaUrls }) {
  const username =
    account.profile_data?.username || account.account_handle || account.account_name;
  return (
    <div className="rounded-lg border bg-white text-gray-900 overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 p-2.5">
        <span className="rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600">
          <span className="block rounded-full bg-white p-[2px]">
            <Avatar account={account} className="h-7 w-7" />
          </span>
        </span>
        <p className="text-sm font-semibold truncate flex-1">{username}</p>
        <MoreHorizontal className="h-4 w-4 text-gray-600 flex-shrink-0" />
      </div>
      <div className="relative">
        {mediaUrls.length > 0 ? (
          <Media url={mediaUrls[0]} className="w-full aspect-square" />
        ) : (
          <div className="w-full aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
            Media required
          </div>
        )}
        {mediaUrls.length > 1 && (
          <span className="absolute top-2 right-2 rounded-full bg-black/60 text-white text-[10px] px-2 py-0.5">
            1/{mediaUrls.length}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3.5 px-3 pt-2.5">
        <Heart className="h-5 w-5" />
        <MessageCircle className="h-5 w-5 -scale-x-100" />
        <Send className="h-5 w-5" />
        <Bookmark className="h-5 w-5 ml-auto" />
      </div>
      <p className="px-3 pt-1.5 text-sm font-semibold">128 likes</p>
      <p className="px-3 pb-3 pt-0.5 text-sm whitespace-pre-wrap break-words">
        <span className="font-semibold">{username}</span> {content}
        <TagText hashtags={hashtags} />
      </p>
    </div>
  );
}

function TwitterPreview({ account, content, hashtags, mediaUrls }) {
  const handle = account.account_handle || account.profile_data?.username || "handle";
  return (
    <div className="rounded-2xl border bg-white text-gray-900 p-3 shadow-sm">
      <div className="flex gap-2.5">
        <Avatar account={account} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-sm">
            <span className="font-bold truncate">{account.account_name}</span>
            <span className="text-gray-500 truncate">@{handle.replace(/^@/, "")}</span>
            <span className="text-gray-500 flex-shrink-0">· now</span>
            <MoreHorizontal className="ml-auto h-4 w-4 text-gray-400 flex-shrink-0" />
          </div>
          <p className="text-sm whitespace-pre-wrap break-words">
            {content}
            <TagText hashtags={hashtags} className="text-sky-500" />
          </p>
          {mediaUrls.length > 0 && (
            <div className="mt-2 rounded-2xl overflow-hidden border">
              <MediaGrid urls={mediaUrls} />
            </div>
          )}
          <div className="flex items-center justify-between mt-2.5 pr-4 text-gray-500">
            <span className="flex items-center gap-1 text-xs">
              <MessageCircle className="h-4 w-4" /> 2
            </span>
            <span className="flex items-center gap-1 text-xs">
              <Repeat2 className="h-4 w-4" /> 5
            </span>
            <span className="flex items-center gap-1 text-xs">
              <Heart className="h-4 w-4" /> 18
            </span>
            <span className="flex items-center gap-1 text-xs">
              <BarChart2 className="h-4 w-4" /> 340
            </span>
            <Share2 className="h-4 w-4" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TikTokPreview({ account, content, hashtags, mediaUrls }) {
  const username =
    account.profile_data?.username || account.account_handle || account.account_name;
  return (
    <div className="relative rounded-lg bg-black text-white overflow-hidden aspect-[9/16] max-h-[460px] w-full">
      {mediaUrls.length > 0 ? (
        <Media url={mediaUrls[0]} className="absolute inset-0 h-full w-full" />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center">
          <Music2 className="h-12 w-12 text-gray-600" />
        </div>
      )}
      <div className="absolute right-2 bottom-24 flex flex-col items-center gap-4 text-white">
        <Avatar account={account} className="h-10 w-10 ring-2 ring-white" />
        <span className="flex flex-col items-center text-[10px]">
          <Heart className="h-6 w-6 fill-white" /> 0
        </span>
        <span className="flex flex-col items-center text-[10px]">
          <MessageCircle className="h-6 w-6 fill-white" /> 0
        </span>
        <span className="flex flex-col items-center text-[10px]">
          <Share2 className="h-6 w-6 fill-white" /> 0
        </span>
      </div>
      <div className="absolute inset-x-0 bottom-0 p-3 pr-16 bg-gradient-to-t from-black/85 via-black/40 to-transparent">
        <p className="font-bold text-sm">@{username.replace(/^@/, "")}</p>
        <p className="text-xs mt-1 whitespace-pre-wrap break-words line-clamp-3">
          {content}
          <TagText hashtags={hashtags} className="font-semibold text-white" />
        </p>
        <p className="text-xs mt-2 flex items-center gap-1.5 text-white/80">
          <Music2 className="h-3 w-3" /> original sound · {account.account_name}
        </p>
      </div>
    </div>
  );
}

function GenericPreview({ account, content, hashtags, mediaUrls }) {
  return (
    <div className="rounded-lg border bg-white text-gray-900 p-3 shadow-sm">
      <div className="flex items-center gap-2.5">
        <Avatar account={account} />
        <p className="text-sm font-semibold truncate">{account.account_name}</p>
      </div>
      <p className="mt-2 text-sm whitespace-pre-wrap break-words">
        {content}
        <TagText hashtags={hashtags} />
      </p>
      {mediaUrls.length > 0 && (
        <div className="mt-2 rounded-lg overflow-hidden">
          <MediaGrid urls={mediaUrls} />
        </div>
      )}
    </div>
  );
}

const PLATFORM_VIEWS = {
  facebook: FacebookPreview,
  instagram: InstagramPreview,
  twitter: TwitterPreview,
  tiktok: TikTokPreview,
};

/**
 * Live, platform-styled preview of a social post.
 *
 * <PostPreview
 *   accounts={selectedAccounts}   // account objects incl. platform + profile_data
 *   content={formData.content}
 *   hashtags={formData.hashtags}
 *   mediaUrls={formData.mediaUrls}
 * />
 */
function MetaRow({ label, children, empty }) {
  return (
    <div className="flex items-start gap-2 text-xs">
      <span className="w-16 flex-shrink-0 font-medium text-muted-foreground">{label}:</span>
      {empty ? (
        <span className="text-muted-foreground/70 italic">none</span>
      ) : (
        <span className="min-w-0 break-words">{children}</span>
      )}
    </div>
  );
}

export default function PostPreview({
  accounts = [],
  content = "",
  hashtags = [],
  mediaUrls = [],
  postType = "Text",
  scheduledFor = "",
}) {
  const [activeId, setActiveId] = useState(null);
  const active = accounts.find((a) => a.id === activeId) || accounts[0];
  const code = active?.platform?.platformCode;
  const PlatformView = PLATFORM_VIEWS[code] || GenericPreview;
  const charLimit = code ? PLATFORM_CHAR_LIMITS[code] : undefined;
  const overLimit = charLimit ? content.length > charLimit : false;

  const meta = [
    {
      label: "Text",
      value: content.trim() || null,
      render: (v) => `${v.length} chars`,
    },
    {
      label: "Tags",
      value: hashtags.length ? hashtags.map((t) => `#${t}`).join(" ") : null,
      render: (v) => v,
    },
    {
      label: "Media",
      value: mediaUrls.length ? mediaUrls : null,
      render: (v) =>
        `${v.length} file${v.length === 1 ? "" : "s"} (${
          v.filter(isVideoMediaUrl).length
        } video, ${v.filter((u) => !isVideoMediaUrl(u)).length} image)`,
    },
    { label: "Type", value: postType || null, render: (v) => v },
    {
      label: "Accounts",
      value: accounts.length ? accounts : null,
      render: (v) => v.map((a) => a.account_name).join(", "),
    },
    {
      label: "Schedule",
      value: scheduledFor || null,
      render: (v) => new Date(v).toLocaleString(),
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Field summary — shows what's set vs. missing */}
        <div className="rounded-md border bg-muted/30 px-3 py-2 space-y-1">
          {meta.map((m) => (
            <MetaRow key={m.label} label={m.label} empty={!m.value}>
              {m.value ? m.render(m.value) : null}
            </MetaRow>
          ))}
        </div>

        {accounts.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Select target accounts to preview the post on each platform.
          </p>
        ) : (
          <>
            {accounts.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                {accounts.map((a) => {
                  const aCode = a.platform?.platformCode;
                  const aLimit = PLATFORM_CHAR_LIMITS[aCode];
                  const isOver = aLimit ? content.length > aLimit : false;
                  const isActive = a.id === active?.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setActiveId(a.id)}
                      className={`relative flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                        isActive
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted"
                      }`}
                      title={a.platform?.name}
                    >
                      {a.platform?.logoUrl ? (
                        <img src={a.platform.logoUrl} alt="" className="h-3.5 w-3.5 rounded-full" />
                      ) : (
                        <Share2 className="h-3 w-3" />
                      )}
                      {a.account_name}
                      {isOver && (
                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500 border border-white" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {!content.trim() && hashtags.length === 0 && mediaUrls.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                Start typing to see a live preview.
              </p>
            ) : (
              <PlatformView
                account={active}
                content={content}
                hashtags={hashtags}
                mediaUrls={mediaUrls}
              />
            )}

            {overLimit && (
              <p className="text-xs text-amber-600">
                Content exceeds the {charLimit}-character limit for{" "}
                {active.platform?.name || code}.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
