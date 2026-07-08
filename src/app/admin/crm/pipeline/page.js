"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  closestCorners,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Loader2,
} from "lucide-react";
import AdminPageHeader from "@/components/AdminPageHeader";
import DealForm from "@/components/crm/DealForm";
import { useAuth } from "@/contexts/auth-context";
import { toast } from "react-hot-toast";

function DealCard({ deal, onEdit }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`bg-white border rounded-lg p-3 mb-2 cursor-grab hover:shadow-md transition-shadow ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="flex justify-between items-start mb-1">
        <h4 className="text-sm font-medium truncate flex-1">{deal.title}</h4>
        <span className="text-sm font-bold text-green-600 ml-2">
          ${deal.value ? Number(deal.value).toLocaleString() : 0}
        </span>
      </div>
      {deal.contact && (
        <p className="text-xs text-muted-foreground truncate">
          {deal.contact.first_name} {deal.contact.last_name}
        </p>
      )}
      <div className="flex items-center gap-2 mt-2">
        {deal.expected_close_date && (
          <Badge variant="outline" className="text-xs">
            {new Date(deal.expected_close_date).toLocaleDateString()}
          </Badge>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(deal);
          }}
        >
          Edit
        </Button>
      </div>
    </div>
  );
}

function StageColumn({ stage, deals, onEdit }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex-1 min-w-[250px] max-w-sm">
      <div
        ref={setNodeRef}
        className={`bg-muted/30 rounded-lg p-3 min-h-[400px] ${
          isOver ? "ring-2 ring-primary" : ""
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: stage.color || "#6b7280" }}
            />
            <h3 className="text-sm font-semibold">{stage.name}</h3>
          </div>
          <Badge variant="secondary" className="text-xs">
            {deals.length}
          </Badge>
        </div>
        <div className="space-y-1">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onEdit={onEdit} />
          ))}
          {deals.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No deals
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PipelineBoardPage() {
  const router = useRouter();
  const { activeClient, user, isLoading: authLoading } = useAuth();
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState(null);
  const [activeDeal, setActiveDeal] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchPipelines = useCallback(async () => {
    if (!activeClient) return;
    try {
      const res = await fetch("/api/v1/crm/pipelines");
      if (!res.ok) throw new Error("Failed to fetch pipelines");
      const { data } = await res.json();
      setPipelines(data || []);
      if (data && data.length > 0 && !selectedPipeline) {
        setSelectedPipeline(data[0]);
      }
    } catch (err) {
      toast.error(err.message);
    }
  }, [activeClient, selectedPipeline]);

  const fetchDeals = useCallback(async () => {
    if (!activeClient || !selectedPipeline) return;
    try {
      const res = await fetch(
        `/api/v1/crm/deals?pipeline_id=${selectedPipeline.id}&status=Open`
      );
      if (!res.ok) throw new Error("Failed to fetch deals");
      const { data } = await res.json();
      setDeals(data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeClient, selectedPipeline]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (activeClient) {
        fetchPipelines();
      }
    }
  }, [authLoading, user, activeClient, router, fetchPipelines]);

  useEffect(() => {
    if (selectedPipeline) {
      fetchDeals();
    }
  }, [selectedPipeline, fetchDeals]);

  const handleDragStart = (event) => {
    const deal = deals.find((d) => d.id === event.active.id);
    setActiveDeal(deal);
  };

  const handleDragEnd = async (event) => {
    setActiveDeal(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id;
    const targetStageId = over.id;
    const deal = deals.find((d) => d.id === dealId);
    if (!deal || deal.stage_id === targetStageId) return;

    try {
      const res = await fetch(`/api/v1/crm/deals/${dealId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: targetStageId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to move deal");
      }
      toast.success("Deal moved");
      fetchDeals();
    } catch (err) {
      toast.error(err.message);
      fetchDeals();
    }
  };

  const handleEditDeal = (deal) => {
    setEditingDeal(deal);
    setDealFormOpen(true);
  };

  const handleCreateDeal = () => {
    setEditingDeal(null);
    setDealFormOpen(true);
  };

  const handleSavedDeal = () => {
    setDealFormOpen(false);
    setEditingDeal(null);
    fetchDeals();
  };

  // Group deals by stage
  const stages = selectedPipeline?.stages || [];
  const dealsByStage = stages.map((stage) => ({
    stage,
    deals: deals.filter((d) => d.stage_id === stage.id),
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Pipeline Board"
        description="Drag and drop deals between stages"
        actionLabel="New Deal"
        actionIcon={<Plus className="h-4 w-4" />}
        onAction={handleCreateDeal}
      />

      {/* Pipeline selector */}
      {pipelines.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {pipelines.map((p) => (
            <Button
              key={p.id}
              variant={selectedPipeline?.id === p.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPipeline(p)}
            >
              {p.name}
              {p.is_default && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  Default
                </Badge>
              )}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !selectedPipeline ? (
        <div className="text-center py-12 text-muted-foreground">
          No pipelines found. Create a pipeline first.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 overflow-x-auto pb-4">
            {dealsByStage.map(({ stage, deals: stageDeals }) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                deals={stageDeals}
                onEdit={handleEditDeal}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDeal ? (
              <div className="bg-white border rounded-lg p-3 shadow-lg opacity-90">
                <h4 className="text-sm font-medium">{activeDeal.title}</h4>
                <span className="text-sm font-bold text-green-600">
                  ${activeDeal.value ? Number(activeDeal.value).toLocaleString() : 0}
                </span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <DealForm
        open={dealFormOpen}
        onOpenChange={setDealFormOpen}
        deal={editingDeal}
        pipeline={selectedPipeline}
        onSaved={handleSavedDeal}
      />
    </div>
  );
}
