import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  GitBranch,
  Play,
  Pause,
  Edit,
  Building2,
  Clock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, addDays } from 'date-fns';
import TutorialTooltip from '../components/TutorialTooltip';
import { createTasksFromSequence } from '@/services/sequenceTaskService';
import toast from 'react-hot-toast';

export default function Sequences() {
  const [isSequenceDialogOpen, setIsSequenceDialogOpen] = useState(false);
  const [isEnrollDialogOpen, setIsEnrollDialogOpen] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState(null);
  const [editingSequence, setEditingSequence] = useState(null);
  const [preSelectedSequenceId, setPreSelectedSequenceId] = useState(null);

  const queryClient = useQueryClient();

  const { data: sequences = [] } = useQuery({
    queryKey: ['sequences'],
    queryFn: () => base44.entities.Sequence.list()
  });

  const { data: enrollments = [] } = useQuery({
    queryKey: ['sequence-enrollments'],
    queryFn: () => base44.entities.SequenceEnrollment.list()
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => base44.entities.Account.list()
  });

  const [newSequence, setNewSequence] = useState({
    name: '',
    description: '',
    account_type: 'general',
    is_active: true,
    steps: [
      { step_number: 1, days_after_previous: 0, action_type: 'email', template: '' }
    ]
  });

  const [enrollmentData, setEnrollmentData] = useState({
    account_id: '',
    sequence_id: ''
  });

  const createSequenceMutation = useMutation({
    mutationFn: (data) => base44.entities.Sequence.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      setIsSequenceDialogOpen(false);
      resetSequenceForm();
      toast.success('✓ Sequence created successfully');
    },
    onError: (error) => {
      console.error('Error creating sequence:', error);
      toast.error(error.message || 'Failed to create sequence');
    }
  });

  const updateSequenceMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Sequence.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequences'] });
      setIsSequenceDialogOpen(false);
      resetSequenceForm();
      toast.success('✓ Sequence updated successfully');
    },
    onError: (error) => {
      console.error('Error updating sequence:', error);
      toast.error(error.message || 'Failed to update sequence');
    }
  });

  const createEnrollmentMutation = useMutation({
    mutationFn: async (data) => {
      const today = new Date();
      const sequence = sequences.find(s => s.id === data.sequence_id);
      const firstStep = sequence?.steps?.[0];
      const nextActionDate = firstStep 
        ? addDays(today, firstStep.days_after_previous).toISOString().split('T')[0]
        : today.toISOString().split('T')[0];

      // Create the enrollment
      const enrollment = await base44.entities.SequenceEnrollment.create({
        ...data,
        status: 'active',
        current_step: 1,
        started_date: today.toISOString().split('T')[0],
        next_action_date: nextActionDate,
        completed_steps: []
      });

      // Create tasks from sequence steps
      if (sequence && data.account_id) {
        try {
          await createTasksFromSequence(enrollment, sequence, data.account_id);
          console.log(`✅ Created tasks from sequence "${sequence.name}" for account ${data.account_id}`);
        } catch (error) {
          console.error('Error creating tasks from sequence:', error);
          // Don't fail enrollment if task creation fails
        }
      }

      return enrollment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setIsEnrollDialogOpen(false);
      setEnrollmentData({ account_id: '', sequence_id: '' });
      setPreSelectedSequenceId(null);
    }
  });

  const updateEnrollmentMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SequenceEnrollment.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sequence-enrollments'] });
    }
  });

  const resetSequenceForm = () => {
    setNewSequence({
      name: '',
      description: '',
      account_type: 'general',
      is_active: true,
      steps: [
        { step_number: 1, days_after_previous: 0, action_type: 'email', template: '' }
      ]
    });
    setEditingSequence(null);
  };

  const handleCreateOrUpdateSequence = () => {
    if (editingSequence) {
      updateSequenceMutation.mutate({
        id: editingSequence.id,
        data: newSequence
      });
    } else {
      createSequenceMutation.mutate(newSequence);
    }
  };

  const openEditDialog = (sequence) => {
    setEditingSequence(sequence);
    setNewSequence({
      name: sequence.name || '',
      description: sequence.description || '',
      account_type: sequence.account_type || 'general',
      is_active: sequence.is_active !== false,
      steps: sequence.steps || [{ step_number: 1, days_after_previous: 0, action_type: 'email', template: '' }]
    });
    setIsSequenceDialogOpen(true);
  };

  const addStep = () => {
    setNewSequence({
      ...newSequence,
      steps: [
        ...newSequence.steps,
        {
          step_number: newSequence.steps.length + 1,
          days_after_previous: 3,
          action_type: 'email',
          template: ''
        }
      ]
    });
  };

  const removeStep = (index) => {
    const updatedSteps = newSequence.steps.filter((_, i) => i !== index);
    setNewSequence({
      ...newSequence,
      steps: updatedSteps.map((step, i) => ({ ...step, step_number: i + 1 }))
    });
  };

  const updateStep = (index, field, value) => {
    const updatedSteps = [...newSequence.steps];
    updatedSteps[index] = { ...updatedSteps[index], [field]: value };
    setNewSequence({ ...newSequence, steps: updatedSteps });
  };

  const handleEnroll = () => {
    const enrollmentPayload = {
      ...enrollmentData,
      sequence_id: enrollmentData.sequence_id || preSelectedSequenceId
    };
    createEnrollmentMutation.mutate(enrollmentPayload);
  };

  const toggleEnrollmentStatus = (enrollment) => {
    const newStatus = enrollment.status === 'active' ? 'paused' : 'active';
    updateEnrollmentMutation.mutate({
      id: enrollment.id,
      data: { status: newStatus }
    });
  };

  const getAccountName = (accountId) => {
    return accounts.find(a => a.id === accountId)?.name || 'Unknown';
  };

  const getSequenceName = (sequenceId) => {
    return sequences.find(s => s.id === sequenceId)?.name || 'Unknown';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <TutorialTooltip
        tip="Create template sequences that automatically generate ordered, blocked tasks for your outreach. Click 'Create Template Sequence' to build a reusable sequence with multiple steps (emails, calls, meetings). Then use 'Enroll Account' to assign a sequence to an account - tasks will automatically appear on your Tasks page in the correct order, with each task blocked until the previous one completes. This automates your follow-up process and ensures nothing falls through the cracks."
        step={7}
        position="bottom"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Sequences</h1>
            <p className="text-slate-600 mt-1">Automate your outreach cadences</p>
          </div>
        <div className="flex gap-3">
          <Dialog 
            open={isEnrollDialogOpen} 
            onOpenChange={(open) => {
              setIsEnrollDialogOpen(open);
              if (!open) {
                // Reset when dialog closes
                setEnrollmentData({ account_id: '', sequence_id: '' });
                setPreSelectedSequenceId(null);
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Play className="w-4 h-4 mr-2" />
                Enroll Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {preSelectedSequenceId 
                    ? `Enroll Account in ${sequences.find(s => s.id === preSelectedSequenceId)?.name || 'Sequence'}`
                    : 'Enroll Account in Sequence'}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                {preSelectedSequenceId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      <strong>Sequence:</strong> {sequences.find(s => s.id === preSelectedSequenceId)?.name}
                    </p>
                  </div>
                )}
                <div>
                  <Label>Select Account *</Label>
                  <Select
                    value={enrollmentData.account_id}
                    onValueChange={(value) => setEnrollmentData({ ...enrollmentData, account_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!preSelectedSequenceId && (
                  <div>
                    <Label>Select Sequence *</Label>
                    <Select
                      value={enrollmentData.sequence_id}
                      onValueChange={(value) => setEnrollmentData({ ...enrollmentData, sequence_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose sequence" />
                      </SelectTrigger>
                      <SelectContent>
                        {sequences.filter(s => s.is_active).map(sequence => (
                          <SelectItem key={sequence.id} value={sequence.id}>
                            {sequence.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex justify-end gap-3">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsEnrollDialogOpen(false);
                      setEnrollmentData({ account_id: '', sequence_id: '' });
                      setPreSelectedSequenceId(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleEnroll}
                    disabled={!enrollmentData.account_id || (!enrollmentData.sequence_id && !preSelectedSequenceId)}
                  >
                    Enroll Account
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog 
            open={isSequenceDialogOpen} 
            onOpenChange={(open) => {
              setIsSequenceDialogOpen(open);
              if (open && !editingSequence) {
                // Reset form when opening for new sequence
                resetSequenceForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="border-slate-300">
                <Plus className="w-4 h-4 mr-2" />
                Create Template Sequence
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>{editingSequence ? 'Edit Sequence' : 'Create New Sequence'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6 py-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Sequence Name *</Label>
                    <Input
                      value={newSequence.name}
                      onChange={(e) => setNewSequence({ ...newSequence, name: e.target.value })}
                      placeholder="Prospect Outreach Sequence"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      value={newSequence.description}
                      onChange={(e) => setNewSequence({ ...newSequence, description: e.target.value })}
                      placeholder="What is this sequence for?"
                      rows={2}
                    />
                  </div>
                  <div>
                    <Label>Account Type</Label>
                    <Select
                      value={newSequence.account_type}
                      onValueChange={(value) => setNewSequence({ ...newSequence, account_type: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="prospect">Prospect</SelectItem>
                        <SelectItem value="high_value_customer">High Value Customer</SelectItem>
                        <SelectItem value="renewal">Renewal</SelectItem>
                        <SelectItem value="at_risk">At Risk</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Steps */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-slate-900 dark:text-white">Sequence Steps</h3>
                    <Button variant="outline" size="sm" onClick={addStep}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Step
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {newSequence.steps.map((step, index) => (
                      <Card key={index} className="border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-semibold flex-shrink-0 mt-1">
                              {step.step_number}
                            </div>
                            <div className="flex-1 grid grid-cols-3 gap-3">
                              <div>
                                <Label className="text-xs">Days After Previous</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={step.days_after_previous}
                                  onChange={(e) => updateStep(index, 'days_after_previous', parseInt(e.target.value))}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Action Type</Label>
                                <Select
                                  value={step.action_type}
                                  onValueChange={(value) => updateStep(index, 'action_type', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="email">Email</SelectItem>
                                    <SelectItem value="call">Call</SelectItem>
                                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                                    <SelectItem value="meeting">Meeting</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-end">
                                {newSequence.steps.length > 1 && (
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="w-full"
                                    onClick={() => removeStep(index)}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </div>
                              <div className="col-span-3">
                                <Label className="text-xs">Template / Notes</Label>
                                <Textarea
                                  value={step.template}
                                  onChange={(e) => updateStep(index, 'template', e.target.value)}
                                  placeholder="Email template, talking points, or action notes..."
                                  rows={2}
                                />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-4 border-t mt-4 flex-shrink-0">
                <Button 
                  variant="outline" 
                  onClick={() => setIsSequenceDialogOpen(false)}
                  disabled={createSequenceMutation.isPending || updateSequenceMutation.isPending}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateOrUpdateSequence} 
                  disabled={!newSequence.name?.trim() || createSequenceMutation.isPending || updateSequenceMutation.isPending}
                >
                  {createSequenceMutation.isPending || updateSequenceMutation.isPending 
                    ? 'Creating...' 
                    : editingSequence 
                      ? 'Update Sequence' 
                      : 'Create Sequence'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      </TutorialTooltip>

      {/* Tabs */}
      <Tabs defaultValue="sequences" className="space-y-6">
        <TabsList>
          <TabsTrigger value="sequences">
            <GitBranch className="w-4 h-4 mr-2" />
            Sequences ({sequences.length})
          </TabsTrigger>
          <TabsTrigger value="enrollments">
            <Building2 className="w-4 h-4 mr-2" />
            Active Enrollments ({enrollments.filter(e => e.status === 'active').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sequences">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sequences.map((sequence) => (
              <Card key={sequence.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{sequence.name}</CardTitle>
                      {sequence.description && (
                        <p className="text-sm text-slate-600 mt-1">{sequence.description}</p>
                      )}
                    </div>
                    <Badge variant={sequence.is_active ? "default" : "secondary"}>
                      {sequence.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Badge variant="outline">
                      {sequence.account_type?.replace('_', ' ')}
                    </Badge>
                    <span>•</span>
                    <span>{sequence.steps?.length || 0} steps</span>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={() => openEditDialog(sequence)}
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setPreSelectedSequenceId(sequence.id);
                        setEnrollmentData({ account_id: '', sequence_id: sequence.id });
                        setIsEnrollDialogOpen(true);
                      }}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Enroll
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {sequences.length === 0 && (
            <Card className="p-12 text-center">
              <GitBranch className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No sequences yet</h3>
              <p className="text-slate-600">Create your first sequence to automate outreach</p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="enrollments">
          <div className="space-y-3">
            {enrollments.map((enrollment) => {
              const accountName = getAccountName(enrollment.account_id);
              const sequenceName = getSequenceName(enrollment.sequence_id);
              
              return (
                <Card key={enrollment.id}>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-slate-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900 dark:text-white">{accountName}</h4>
                          <p className="text-sm text-slate-600">{sequenceName}</p>
                          <div className="flex items-center gap-3 mt-2">
                            <Badge variant="outline" className="text-xs">
                              Step {enrollment.current_step}
                            </Badge>
                            <Badge 
                              className={
                                enrollment.status === 'active' 
                                  ? 'bg-emerald-100 text-emerald-800' 
                                  : 'bg-slate-100 text-slate-600'
                              }
                            >
                              {enrollment.status}
                            </Badge>
                            {enrollment.next_action_date && (
                              <div className="flex items-center gap-1 text-xs text-slate-600">
                                <Clock className="w-3 h-3" />
                                Next: {format(new Date(enrollment.next_action_date), 'MMM d')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleEnrollmentStatus(enrollment)}
                      >
                        {enrollment.status === 'active' ? (
                          <>
                            <Pause className="w-4 h-4 mr-2" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 mr-2" />
                            Resume
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {enrollments.length === 0 && (
            <Card className="p-12 text-center">
              <Building2 className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-slate-900 dark:text-white mb-1">No enrollments yet</h3>
              <p className="text-slate-600">Enroll accounts in sequences to start automated outreach</p>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

