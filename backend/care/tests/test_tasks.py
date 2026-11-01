from datetime import datetime

from django.utils import timezone

from care.models import Task
from care.tasks import visible_tasks

from .helpers import FamilyTestCase


def nairobi(day, hour):
    return timezone.make_aware(datetime(2026, 10, day, hour))


FRI, SAT, MON, TUE = nairobi(16, 10), nairobi(17, 12), nairobi(19, 12), nairobi(20, 12)


class RecurringTaskRulesTests(FamilyTestCase):
    def test_test_dates_are_the_weekdays_we_think_they_are(self):
        self.assertEqual([d.weekday() for d in (FRI, SAT, MON, TUE)], [4, 5, 0, 1])

    def test_recurring_task_resets_on_the_next_working_day_only(self):
        task = Task.objects.create(caretaker=self.caretaker, title='Medication', recurring=True, is_done=True, done_at=FRI)
        visible_tasks(self.caretaker, SAT)
        task.refresh_from_db()
        self.assertTrue(task.is_done)  # Saturday is not a working day
        visible_tasks(self.caretaker, MON)
        task.refresh_from_db()
        self.assertFalse(task.is_done)
        self.assertIsNone(task.done_at)

    def test_one_off_task_stays_visible_only_on_the_day_it_was_done(self):
        Task.objects.create(caretaker=self.caretaker, title='Buy milk', is_done=True, done_at=nairobi(19, 9))
        self.assertIn('Buy milk', [t.title for t in visible_tasks(self.caretaker, MON)])
        self.assertNotIn('Buy milk', [t.title for t in visible_tasks(self.caretaker, TUE)])

    def test_recurring_task_is_always_listed(self):
        Task.objects.create(caretaker=self.caretaker, title='Medication', recurring=True)
        self.assertIn('Medication', [t.title for t in visible_tasks(self.caretaker, TUE)])


class TaskApiTests(FamilyTestCase):
    def test_create_tick_untick_delete(self):
        r = self.caretaker_api.post('/api/tasks/', {'title': 'Give tea', 'recurring': True}, format='json')
        self.assertEqual(r.status_code, 201)
        tid = r.data['id']
        self.put_in_range()
        done = self.caretaker_api.patch(f'/api/tasks/{tid}/', {'is_done': True}, format='json').data
        self.assertTrue(done['is_done'])
        self.assertIsNotNone(done['done_at'])
        undone = self.caretaker_api.patch(f'/api/tasks/{tid}/', {'is_done': False}, format='json').data
        self.assertIsNone(undone['done_at'])
        self.assertEqual(self.caretaker_api.delete(f'/api/tasks/{tid}/').status_code, 204)
        self.assertEqual(self.caretaker_api.get('/api/tasks/').data, [])

    def _new_task(self):
        return self.caretaker_api.post('/api/tasks/', {'title': 'Give tea'}, format='json').data['id']

    def test_cannot_mark_done_outside_the_elders_area(self):
        tid = self._new_task()
        self.put_in_range(metres=60)
        r = self.caretaker_api.patch(f'/api/tasks/{tid}/', {'is_done': True}, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertIn('60 m', r.data['detail'])
        self.assertFalse(Task.objects.get(pk=tid).is_done)

    def test_cannot_mark_done_when_location_is_unknown(self):
        tid = self._new_task()  # nobody has shared a location yet
        r = self.caretaker_api.patch(f'/api/tasks/{tid}/', {'is_done': True}, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertFalse(Task.objects.get(pk=tid).is_done)

    def test_cannot_mark_done_with_a_faked_location(self):
        from .helpers import place

        tid = self._new_task()
        place(self.elder, 0)
        place(self.caretaker, 5, mocked=True)
        r = self.caretaker_api.patch(f'/api/tasks/{tid}/', {'is_done': True}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_unticking_and_editing_work_anywhere(self):
        tid = self._new_task()
        self.put_in_range()
        self.caretaker_api.patch(f'/api/tasks/{tid}/', {'is_done': True}, format='json')
        self.put_in_range(metres=500)
        r = self.caretaker_api.patch(f'/api/tasks/{tid}/', {'is_done': False, 'recurring': True}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.data['is_done'])

    def test_validation(self):
        self.assertEqual(self.caretaker_api.post('/api/tasks/', {'title': '  '}, format='json').status_code, 400)
        self.assertEqual(self.caretaker_api.post('/api/tasks/', {'title': 'x' * 201}, format='json').status_code, 400)

    def test_the_elderly_have_no_task_list(self):
        self.assertEqual(self.elder_api.get('/api/tasks/').status_code, 403)
        self.assertEqual(self.elder_api.post('/api/tasks/', {'title': 'x'}, format='json').status_code, 403)

    def test_a_caretaker_cannot_touch_someone_elses_task(self):
        other = Task.objects.create(caretaker=self.sponsor, title='Not yours')  # any task owned by another user
        r = self.caretaker_api.patch(f'/api/tasks/{other.pk}/', {'is_done': True}, format='json')
        self.assertEqual(r.status_code, 400)
        other.refresh_from_db()
        self.assertFalse(other.is_done)

    def test_completion_is_recorded_on_the_open_shift(self):
        self.put_in_range()
        self.caretaker_api.get('/api/shift/state/')  # starts the shift automatically
        r = self.caretaker_api.post('/api/tasks/', {'title': 'Bathing'}, format='json')
        self.caretaker_api.patch(f"/api/tasks/{r.data['id']}/", {'is_done': True}, format='json')
        chore = self.caretaker.shifts.get().chores.get(description='Bathing')
        self.assertTrue(chore.is_done)


class FamilyAssignedTaskTests(FamilyTestCase):
    def _assign(self, title='Take her for a short walk', **extra):
        return self.sponsor_api.post(
            '/api/tasks/', {'title': title, 'caretaker_email': self.caretaker.email, **extra}, format='json'
        )

    def test_family_assigns_a_task_and_the_caretaker_sees_who_set_it(self):
        r = self._assign(recurring=True)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['assigned_by'], 'Pat Parent')
        self.assertEqual(r.data['caretaker'], 'Cara Care')
        [t] = self.caretaker_api.get('/api/tasks/').data
        self.assertEqual((t['title'], t['assigned_by'], t['recurring']), ('Take her for a short walk', 'Pat Parent', True))
        own = self.caretaker_api.post('/api/tasks/', {'title': 'Tidy kitchen'}, format='json').data
        self.assertIsNone(own['assigned_by'])

    def test_family_sees_all_their_caretakers_tasks(self):
        self._assign()
        self.caretaker_api.post('/api/tasks/', {'title': 'Tidy kitchen'}, format='json')
        titles = {t['title'] for t in self.sponsor_api.get('/api/tasks/').data}
        self.assertEqual(titles, {'Take her for a short walk', 'Tidy kitchen'})

    def test_caretaker_ticks_it_off_only_inside_the_area(self):
        tid = self._assign().data['id']
        self.put_in_range(metres=60)
        self.assertEqual(self.caretaker_api.patch(f'/api/tasks/{tid}/', {'is_done': True}, format='json').status_code, 403)
        self.put_in_range()
        r = self.caretaker_api.patch(f'/api/tasks/{tid}/', {'is_done': True}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.data['is_done'])
        [chore] = [c for c in self.sponsor_api.get('/api/dashboard/').data['today']['chores'] if c['id'] == tid]
        self.assertTrue(chore['is_done'])
        self.assertTrue(chore['assigned_by_me'])

    def test_caretaker_cannot_change_or_delete_a_family_task(self):
        tid = self._assign().data['id']
        self.assertEqual(self.caretaker_api.delete(f'/api/tasks/{tid}/').status_code, 403)
        self.assertEqual(self.caretaker_api.patch(f'/api/tasks/{tid}/', {'recurring': True}, format='json').status_code, 403)
        self.assertEqual(self.caretaker_api.patch(f'/api/tasks/{tid}/', {'title': 'Skip'}, format='json').status_code, 403)
        self.assertTrue(Task.objects.filter(pk=tid, recurring=False, title='Take her for a short walk').exists())

    def test_family_can_edit_and_remove_their_task_but_not_tick_it(self):
        tid = self._assign().data['id']
        self.assertEqual(self.sponsor_api.patch(f'/api/tasks/{tid}/', {'is_done': True}, format='json').status_code, 403)
        r = self.sponsor_api.patch(f'/api/tasks/{tid}/', {'recurring': True}, format='json')
        self.assertTrue(r.data['recurring'])
        self.assertEqual(self.sponsor_api.delete(f'/api/tasks/{tid}/').status_code, 204)
        self.assertFalse(Task.objects.filter(pk=tid).exists())

    def test_family_cannot_touch_the_caretakers_own_tasks(self):
        tid = self.caretaker_api.post('/api/tasks/', {'title': 'Tidy kitchen'}, format='json').data['id']
        self.assertEqual(self.sponsor_api.delete(f'/api/tasks/{tid}/').status_code, 400)
        self.assertTrue(Task.objects.filter(pk=tid).exists())

    def test_family_can_only_assign_to_their_own_caretakers(self):
        from accounts.models import Role
        from .helpers import client_for, make_user

        other_family = make_user('other@example.com', 'Olu Other')
        make_user('care2@example.com', 'Cal Care', Role.CARETAKER, other_family)
        r = self.sponsor_api.post('/api/tasks/', {'title': 'x', 'caretaker_email': 'care2@example.com'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.sponsor_api.post('/api/tasks/', {'title': 'x'}, format='json').status_code, 400)
        tid = self._assign().data['id']
        self.assertEqual(client_for(other_family).delete(f'/api/tasks/{tid}/').status_code, 400)
        self.assertEqual(self._assign(title=' ').status_code, 400)
