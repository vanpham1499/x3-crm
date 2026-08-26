'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CrmFlowBar } from '@/components/crm/crm-flow-bar';
import { ConfirmDialog } from '@/components/feedback/confirm-dialog';
import { useAppNotification } from '@/components/feedback/notification-provider';
import { ContentLoading } from '@/components/shell/content-loading';
import { PageHeader } from '@/components/shell/page-header';
import { CustomerApiForm } from '@/features/customers/components/customer-api-form';
import { buildCustomerPayload, createEmptyCustomerFormValues } from '@/lib/customer-form-utils';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/services/api/client';
import type { Customer, CustomerFormValues, DeletedCustomerCodeConflict } from '@/types/customer';
import type { Lead } from '@/types/lead';
import type { AppOption } from '@/types/option';
import type { User } from '@/types/user';

export default function NewCustomerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const notify = useAppNotification();
  const leadId = searchParams.get('leadId') || '';
  const [deletedCodeConflict, setDeletedCodeConflict] = useState<{
    customer: DeletedCustomerCodeConflict;
    values: CustomerFormValues;
  } | null>(null);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users', 'customer-form-options'],
    queryFn: () => api.get('/users/lookup?context=customer').then((response) => response.data),
  });

  const { data: options = [] } = useQuery<AppOption[]>({
    queryKey: ['options', 'customer-form'],
    queryFn: () =>
      api
        .get('/options', { params: { groups: 'customer_type,lead_source' } })
        .then((response) => response.data),
  });

  const {
    data: lead,
    isError: isLeadError,
    isLoading: isLeadLoading,
  } = useQuery<Lead>({
    queryKey: ['leads', leadId, 'customer-create'],
    queryFn: () => api.get(`/leads/${leadId}`).then((response) => response.data),
    enabled: Boolean(leadId),
    retry: false,
  });

  const { data: existingCustomers = [], isLoading: isExistingCustomerLoading } = useQuery<
    Customer[]
  >({
    queryKey: ['customers', 'by-lead', leadId],
    queryFn: () =>
      api.get('/customers', { params: { lead_id: leadId } }).then((response) => response.data),
    enabled: Boolean(leadId),
    retry: false,
  });

  const customerTypes = options.filter((option) => option.group === 'customer_type');
  const sources = options.filter((option) => option.group === 'lead_source');

  const defaultValues = useMemo(() => createEmptyCustomerFormValues(lead || null), [lead]);

  const existingCustomer = existingCustomers[0];
  const convertedCustomerId = existingCustomer?.id || lead?.convertedCustomer?.id;
  const hasConvertedCustomer = Boolean(convertedCustomerId);

  useEffect(() => {
    if (!leadId) {
      notify.error('Chỉ có thể tạo khách hàng từ một lead hợp lệ');
      router.replace('/leads');
      return;
    }

    if (isLeadError) {
      notify.error('Lead không tồn tại hoặc đã bị xóa');
      router.replace('/leads');
      return;
    }

    if (hasConvertedCustomer) {
      router.replace(`/customers/${convertedCustomerId}`);
    }
  }, [convertedCustomerId, hasConvertedCustomer, isLeadError, leadId, notify, router]);

  const createMutation = useMutation({
    mutationFn: async ({
      values,
      purgeDeletedDuplicate = false,
    }: {
      values: CustomerFormValues;
      purgeDeletedDuplicate?: boolean;
    }) => {
      if (!leadId || !lead) {
        throw new Error('Chỉ có thể tạo khách hàng từ một lead hợp lệ');
      }

      if (hasConvertedCustomer) {
        throw new Error('Lead này đã được chuyển thành khách hàng');
      }

      return api
        .post<Customer>('/customers', {
          ...buildCustomerPayload(values),
          purgeDeletedDuplicate,
        })
        .then((response) => response.data);
    },
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      notify.success('Tạo khách hàng thành công');
      setDeletedCodeConflict(null);
      router.push(`/customers/${customer.id}`);
    },
    onError: (error, variables) => {
      const responseData = (error as any)?.response?.data;
      const conflict = responseData?.deletedCustomer as DeletedCustomerCodeConflict | undefined;

      if (responseData?.code === 'deleted_customer_code_conflict' && conflict) {
        if (!conflict.canPurge) {
          const reason = conflict.blockers?.length
            ? ` vì đang có ${conflict.blockers.join(', ')}`
            : ' do bạn không có quyền xóa dữ liệu cũ';
          notify.error(
            `Mã này thuộc ${conflict.displayName} đã xóa và không thể xóa hẳn${reason}.`,
          );
          return;
        }

        setDeletedCodeConflict({ customer: conflict, values: variables.values });
        return;
      }

      notify.error(getApiErrorMessage(error, 'Tạo khách hàng thất bại'));
    },
  });

  const deletedAtLabel = useMemo(() => {
    const value = deletedCodeConflict?.customer.deletedAt;
    if (!value) return 'không rõ thời gian';

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(parsed);
  }, [deletedCodeConflict?.customer.deletedAt]);

  if (
    !leadId ||
    isLeadError ||
    hasConvertedCustomer ||
    isLeadLoading ||
    isExistingCustomerLoading
  ) {
    return <ContentLoading />;
  }

  return (
    <>
      <div className="flex min-h-[calc(100vh-72px)] flex-col bg-slate-50/60 px-6 pt-6">
        <PageHeader
          title="Chuyển Lead thành khách hàng"
          breadcrumbs={[
            { label: 'Dashboard', href: '/dashboard' },
            { label: `Lead ${lead?.leadCode || leadId}`, href: `/leads/${leadId}` },
            { label: 'Tạo Customer' },
          ]}
        />

        <CrmFlowBar
          steps={[
            { label: 'Lead', state: 'done', href: `/leads/${leadId}` },
            { label: 'Customer', state: 'active' },
            { label: 'Dự án', state: 'pending' },
          ]}
        />

        <CustomerApiForm
          mode="create"
          defaultValues={defaultValues}
          users={users}
          customerTypes={customerTypes}
          sources={sources}
          cancelHref={`/leads/${leadId}`}
          isSubmitting={createMutation.isPending}
          onSubmit={(values) => createMutation.mutateAsync({ values })}
        />
      </div>

      <ConfirmDialog
        open={Boolean(deletedCodeConflict)}
        title={
          deletedCodeConflict?.customer.blockers?.length
            ? 'Xóa toàn bộ dữ liệu khách hàng cũ?'
            : 'Mã khách hàng đã từng tồn tại'
        }
        description={
          deletedCodeConflict?.customer.blockers?.length
            ? `Mã ${deletedCodeConflict.customer.customerCode} thuộc “${deletedCodeConflict.customer.displayName}”, đã xóa lúc ${deletedAtLabel}. Hồ sơ cũ đang có ${deletedCodeConflict.customer.blockers.join(', ')}. Nếu tiếp tục, toàn bộ hồ sơ và dữ liệu liên quan này sẽ bị xóa vĩnh viễn trước khi tạo khách hàng mới.`
            : `Mã ${deletedCodeConflict?.customer.customerCode || ''} là dữ liệu của “${deletedCodeConflict?.customer.displayName || 'khách hàng cũ'}”, đã xóa lúc ${deletedAtLabel}. Bạn có muốn xóa vĩnh viễn dữ liệu cũ và tiếp tục tạo khách hàng mới không?`
        }
        confirmText={
          deletedCodeConflict?.customer.blockers?.length
            ? 'Xóa toàn bộ & tạo mới'
            : 'Xóa hẳn & tạo mới'
        }
        cancelText="Không xóa"
        loading={createMutation.isPending}
        onClose={() => setDeletedCodeConflict(null)}
        onConfirm={() => {
          if (!deletedCodeConflict) return;
          createMutation.mutate({
            values: deletedCodeConflict.values,
            purgeDeletedDuplicate: true,
          });
        }}
      />
    </>
  );
}
