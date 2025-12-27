import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, Plus } from 'lucide-react';

export default function PaymentMethod({ account, onAddPayment }) {
  const hasPaymentMethod = account.payment_method || false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
          Payment Method
        </CardTitle>
      </CardHeader>
      <CardContent>
        {hasPaymentMethod ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-slate-400" />
              <span className="font-medium text-slate-900 dark:text-white">
                {account.payment_method_type || 'Card on file'}
              </span>
            </div>
            {account.payment_last_four && (
              <p className="text-sm text-slate-600">
                •••• {account.payment_last_four}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              A payment method has not been set up for this customer.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={onAddPayment}
              className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Payment Method
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}




















