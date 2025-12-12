import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../../utils';

export default function CreateScorecardDialog({ accountId, accountName }) {
  const [open, setOpen] = useState(false);
  const [scorecardType, setScorecardType] = useState('template'); // 'template' or 'custom'
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const navigate = useNavigate();

  const { data: templates = [] } = useQuery({
    queryKey: ['scorecard-templates'],
    queryFn: () => base44.entities.ScorecardTemplate.list()
  });

  const activeTemplates = templates.filter(t => t.is_active);

  const handleCreate = () => {
    if (scorecardType === 'template') {
      if (!selectedTemplateId) {
        alert('Please select a template');
        return;
      }
      // Navigate to BuildScorecard to customize the template
      navigate(createPageUrl(`BuildScorecard?accountId=${accountId}&templateId=${selectedTemplateId}`));
    } else {
      // Navigate to BuildScorecard with custom mode (no template)
      navigate(createPageUrl(`BuildScorecard?accountId=${accountId}&custom=true&name=${encodeURIComponent(customName)}&description=${encodeURIComponent(customDescription)}`));
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Create Scorecard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Scorecard for {accountName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div>
            <Label className="text-base font-semibold mb-3 block">Scorecard Type</Label>
            <RadioGroup value={scorecardType} onValueChange={setScorecardType}>
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="template" id="template" />
                <Label htmlFor="template" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-slate-600" />
                    <div>
                      <div className="font-medium">Use Template</div>
                      <div className="text-sm text-slate-600">Start from an existing scorecard template</div>
                    </div>
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-4 border rounded-lg hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="custom" id="custom" />
                <Label htmlFor="custom" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Plus className="w-5 h-5 text-slate-600" />
                    <div>
                      <div className="font-medium">Custom Scorecard</div>
                      <div className="text-sm text-slate-600">Create a custom scorecard with your own questions</div>
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {scorecardType === 'template' && (
            <div className="space-y-2">
              <Label>Select Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {activeTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                      {template.description && (
                        <span className="text-slate-500 ml-2">- {template.description}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activeTemplates.length === 0 && (
                <p className="text-sm text-slate-500">No active templates available. Create one in the Scoring page.</p>
              )}
            </div>
          )}

          {scorecardType === 'custom' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Scorecard Name</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g., Q1 2025 Review, Custom ICP Assessment"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea
                  value={customDescription}
                  onChange={(e) => setCustomDescription(e.target.value)}
                  placeholder="Describe the purpose of this scorecard..."
                  rows={3}
                />
              </div>
              <p className="text-sm text-slate-500">
                You'll be able to add custom questions after creating the scorecard.
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate}
              disabled={
                (scorecardType === 'template' && !selectedTemplateId) ||
                (scorecardType === 'custom' && !customName.trim())
              }
            >
              {scorecardType === 'template' ? 'Continue with Template' : 'Create Custom Scorecard'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

