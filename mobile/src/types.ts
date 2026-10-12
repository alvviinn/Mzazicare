// 'user' is the family sponsor (the account everyone starts with).
// 'caretaker' and 'elderly' are assigned when a user adds that person's email.
export type Role = 'user' | 'caretaker' | 'elderly';

export type Member = {
  email: string;
  name: string | null; // null while the invite is still pending
  status: 'active' | 'pending';
};

export type Profile = {
  id: string;
  name: string;
  email: string;
  role: Role;
  sponsor: { name: string; email: string } | null; // the user who linked this family
  caretakers: Member[];
  elderly: Member[];
};

export type AuthResult = { token: string; name: string; role: Role };
