import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';

export default function AccountTags({ tags = [], onUpdateTags }) {
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    if (tags.includes(newTag.trim())) return;
    
    const updatedTags = [...tags, newTag.trim()];
    if (onUpdateTags) {
      onUpdateTags(updatedTags);
    }
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove) => {
    const updatedTags = tags.filter(tag => tag !== tagToRemove);
    if (onUpdateTags) {
      onUpdateTags(updatedTags);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Tags
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Existing tags */}
          {tags && tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="text-slate-700 border-slate-300 pr-1"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:bg-slate-200 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* Add new tag */}
          <div className="flex gap-2">
            <Input
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type to add Tags"
              className="flex-1"
            />
            <Button
              onClick={handleAddTag}
              disabled={!newTag.trim()}
              className="bg-emerald-600 hover:bg-emerald-700"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Tag
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}














