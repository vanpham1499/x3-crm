'use client';
import { useEffect, useState } from 'react';
import { TeamDialog } from './dialog';
import { TeamSelect } from './team-select';
import { accessRequest } from '../use-account-access';
import type { AccountAccess } from '../account-access';
import styles from '../zalo-team.module.css';
import css from '../account-permissions.module.css';

type Grant = { userId: number; level: 'read' | 'operate'; canSync: boolean; canLink: boolean };
export type AccessDirectory = {
  access: AccountAccess;
  accounts: {
    account_id: number;
    department_id: number | null;
    primary_user_id: number | null;
    revision: number;
  }[];
  departments: { id: number; name: string }[];
  users: { id: number; name: string; department_id: number | null }[];
  grants: {
    account_id: number;
    user_id: number;
    level: 'read' | 'operate';
    can_sync: boolean;
    can_link: boolean;
  }[];
};
export function AccountPermissions({
  id,
  name,
  onClose,
  onSaved,
}: {
  id: number;
  name: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [data, setData] = useState<AccessDirectory | null>(null);
  const [team, setTeam] = useState('');
  const [primary, setPrimary] = useState('');
  const [grants, setGrants] = useState<Grant[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    accessRequest({ kind: 'read' })
      .then((d: AccessDirectory) => {
        if (!active) return;
        const a = d.accounts.find((a) => a.account_id === id);
        if (!a) throw Error('Bạn không còn quyền phân công tài khoản này.');
        setData(d);
        setTeam(String(a.department_id || ''));
        setPrimary(String(a.primary_user_id || ''));
        setGrants(
          d.grants
            .filter(
              (g) =>
                g.account_id === id &&
                (d.access.admin ||
                  d.users.find((u) => u.id === g.user_id)?.department_id === a.department_id),
            )
            .map((g) => ({
              userId: g.user_id,
              level: g.level,
              canSync: g.can_sync,
              canLink: g.can_link,
            })),
        );
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [id]);
  function change(userId: number, patch: Partial<Grant>) {
    setGrants((gs) => gs.map((g) => (g.userId === userId ? { ...g, ...patch } : g)));
  }
  async function save() {
    if (!data) return;
    setBusy(true);
    setError('');
    try {
      await accessRequest({
        kind: 'save',
        accountId: id,
        revision: data.accounts.find((a) => a.account_id === id)!.revision,
        departmentId: team ? Number(team) : null,
        primaryUserId: primary ? Number(primary) : null,
        grants,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Chưa lưu được.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <TeamDialog
      title={`Phân quyền · ${name}`}
      className={css.dialog}
      onClose={() => !busy && onClose()}
    >
      <div className={css.body}>
        {error && (
          <p role="alert" className={css.error}>
            {error}
          </p>
        )}
        {!data ? (
          <p>Đang tải phân quyền…</p>
        ) : (
          <>
            <div className={css.fields}>
              <label>
                Phòng ban quản lý
                <TeamSelect
                  aria-label="Phòng ban quản lý"
                  value={team}
                  disabled={!data.access.admin || busy}
                  onChange={(e) => {
                    setTeam(e.target.value);
                    setPrimary('');
                    if (!e.target.value) setGrants([]);
                  }}
                >
                  <option value="">Chưa phân công · chỉ admin</option>
                  {data.departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </TeamSelect>
              </label>
              <label>
                Người phụ trách
                <TeamSelect
                  aria-label="Người phụ trách"
                  value={primary}
                  disabled={!team || busy}
                  onChange={(e) => {
                    const v = e.target.value;
                    setPrimary(v);
                    if (v && !grants.some((g) => g.userId === Number(v)))
                      setGrants([
                        ...grants,
                        { userId: Number(v), level: 'operate', canSync: false, canLink: false },
                      ]);
                  }}
                >
                  <option value="">Chưa chọn</option>
                  {data.users
                    .filter((u) => u.department_id === Number(team))
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                </TeamSelect>
              </label>
            </div>
            <p className={css.hint}>
              Admin và trưởng phòng quản lý có quyền sử dụng. Chia sẻ bên dưới không mở quyền cho
              trưởng phòng khác.
            </p>
            <label className={css.search}>
              Người được sử dụng
              <input
                placeholder="Tìm nhân viên…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className={css.people}>
              {data.users
                .filter((u) => data.access.admin || u.department_id === Number(team))
                .filter((u) =>
                  u.name.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi')),
                )
                .map((u) => {
                  const grant = grants.find((g) => g.userId === u.id);
                  return (
                    <div className={css.person} key={u.id}>
                      <label className={css.identity}>
                        <input
                          type="checkbox"
                          disabled={!team || busy}
                          checked={!!grant}
                          onChange={(e) => {
                            if (e.target.checked)
                              setGrants([
                                ...grants,
                                { userId: u.id, level: 'read', canSync: false, canLink: false },
                              ]);
                            else {
                              setGrants(grants.filter((g) => g.userId !== u.id));
                              if (primary === String(u.id)) setPrimary('');
                            }
                          }}
                        />
                        <span>
                          {u.name}
                          <small>
                            {data.departments.find((d) => d.id === u.department_id)?.name ||
                              'Phòng ban khác'}
                          </small>
                        </span>
                      </label>
                      {grant && (
                        <div className={css.options}>
                          <TeamSelect
                            aria-label={`Quyền của ${u.name}`}
                            value={grant.level}
                            disabled={busy}
                            onChange={(e) =>
                              change(u.id, {
                                level: e.target.value as Grant['level'],
                                ...(e.target.value === 'read'
                                  ? { canSync: false, canLink: false }
                                  : {}),
                              })
                            }
                          >
                            <option value="read">Chỉ xem</option>
                            <option value="operate">Sử dụng</option>
                          </TeamSelect>
                          {grant.level === 'operate' && (
                            <>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={grant.canSync}
                                  disabled={busy}
                                  onChange={(e) => change(u.id, { canSync: e.target.checked })}
                                />
                                Đồng bộ
                              </label>
                              <label>
                                <input
                                  type="checkbox"
                                  checked={grant.canLink}
                                  disabled={busy}
                                  onChange={(e) => change(u.id, { canLink: e.target.checked })}
                                />
                                Kết nối lại
                              </label>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </>
        )}
      </div>
      <footer className={css.footer}>
        <button className={styles.secondaryButton} disabled={busy} onClick={onClose}>
          Hủy
        </button>
        <button
          className={styles.primaryButton}
          disabled={!data || busy}
          onClick={() => void save()}
        >
          {busy ? 'Đang lưu…' : 'Lưu phân quyền'}
        </button>
      </footer>
    </TeamDialog>
  );
}
