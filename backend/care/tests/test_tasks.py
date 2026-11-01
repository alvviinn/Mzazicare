from datetime import datetime

from django.utils import timezone

from care.models import Task, TaskCompletion
from care.tasks import visible_tasks

from .helpers import JPEG, FamilyTestCase


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
        done = self.tick(tid).data
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
        r = self.tick(tid)
        self.assertEqual(r.status_code, 403)
        self.assertIn('60 m', r.data['detail'])
        self.assertFalse(Task.objects.get(pk=tid).is_done)

    def test_cannot_mark_done_when_location_is_unknown(self):
        tid = self._new_task()  # nobody has shared a location yet
        r = self.tick(tid)
        self.assertEqual(r.status_code, 403)
        self.assertFalse(Task.objects.get(pk=tid).is_done)

    def test_cannot_mark_done_with_a_faked_location(self):
        from .helpers import place

        tid = self._new_task()
        place(self.elder, 0)
        place(self.caretaker, 5, mocked=True)
        r = self.tick(tid)
        self.assertEqual(r.status_code, 403)

    def test_unticking_and_editing_work_anywhere(self):
        tid = self._new_task()
        self.put_in_range()
        self.tick(tid)
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
        r = self.tick(other.pk)
        self.assertEqual(r.status_code, 400)
        other.refresh_from_db()
        self.assertFalse(other.is_done)

    def test_completion_is_recorded_on_the_open_shift(self):
        self.put_in_range()
        self.caretaker_api.get('/api/shift/state/')  # starts the shift automatically
        r = self.caretaker_api.post('/api/tasks/', {'title': 'Bathing'}, format='json')
        self.tick(r.data['id'])
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
        self.assertEqual(self.tick(tid).status_code, 403)
        self.put_in_range()
        r = self.tick(tid)
        self.assertEqual(r.status_code, 201)
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


class ProofPhotoAndHistoryTests(FamilyTestCase):
    def setUp(self):
        super().setUp()
        self.tid = self.caretaker_api.post('/api/tasks/', {'title': 'Give tea', 'recurring': True}, format='json').data['id']
        self.put_in_range()

    def test_a_task_cannot_be_ticked_without_a_photo(self):
        r = self.caretaker_api.patch(f'/api/tasks/{self.tid}/', {'is_done': True}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertIn('photo', r.data['detail'])
        self.assertEqual(self.tick(self.tid, photo=b'').status_code, 400)
        self.assertEqual(self.tick(self.tid, photo=b'not an image at all').status_code, 400)
        self.assertFalse(Task.objects.get(pk=self.tid).is_done)
        self.assertFalse(TaskCompletion.objects.exists())

    def test_an_oversized_photo_is_refused(self):
        from care.tasks import MAX_PHOTO_BYTES

        self.assertEqual(self.tick(self.tid, photo=JPEG + b'0' * MAX_PHOTO_BYTES).status_code, 413)

    def test_no_photo_is_kept_when_the_caretaker_is_outside_the_area(self):
        self.put_in_range(metres=60)
        self.assertEqual(self.tick(self.tid).status_code, 403)
        self.assertFalse(TaskCompletion.objects.exists())

    def test_the_family_sees_the_proof_photo(self):
        cid = self.tick(self.tid).data['completion_id']
        self.assertIsNotNone(cid)
        [chore] = self.sponsor_api.get('/api/dashboard/').data['today']['chores']
        self.assertEqual(chore['completion_id'], cid)
        r = self.sponsor_api.get(f'/api/tasks/completions/{cid}/photo/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r['Content-Type'], 'image/jpeg')
        self.assertEqual(r.content, JPEG)
        self.assertEqual(self.caretaker_api.get(f'/api/tasks/completions/{cid}/photo/').content, JPEG)

    def test_nobody_else_can_see_the_photo(self):
        from accounts.models import Role
        from .helpers import client_for, make_user

        cid = self.tick(self.tid).data['completion_id']
        other_family = make_user('other@example.com', 'Olu Other')
        other_carer = make_user('care2@example.com', 'Cal Care', Role.CARETAKER, other_family)
        for api in (client_for(other_family), client_for(other_carer)):
            self.assertEqual(api.get(f'/api/tasks/completions/{cid}/photo/').status_code, 400)
            self.assertEqual(api.get('/api/tasks/history/').data['items'], [])
        self.assertEqual(self.elder_api.get(f'/api/tasks/completions/{cid}/photo/').status_code, 403)
        from rest_framework.test import APIClient

        self.assertEqual(APIClient().get(f'/api/tasks/completions/{cid}/photo/').status_code, 401)

    def test_a_double_tap_records_the_task_once(self):
        self.tick(self.tid)
        self.assertEqual(self.tick(self.tid).status_code, 200)
        self.assertEqual(TaskCompletion.objects.count(), 1)

    def test_unticking_removes_that_proof(self):
        self.tick(self.tid)
        r = self.caretaker_api.patch(f'/api/tasks/{self.tid}/', {'is_done': False}, format='json')
        self.assertFalse(r.data['is_done'])
        self.assertIsNone(r.data['completion_id'])
        self.assertFalse(TaskCompletion.objects.exists())

    def test_history_keeps_every_day_a_recurring_task_was_done(self):
        from datetime import timedelta

        self.tick(self.tid)
        TaskCompletion.objects.update(done_at=timezone.now() - timedelta(days=2))  # pretend that was two days ago
        Task.objects.filter(pk=self.tid).update(is_done=False, done_at=None)  # the daily reset
        self.tick(self.tid)
        for api in (self.caretaker_api, self.sponsor_api):
            items = api.get('/api/tasks/history/').data['items']
            self.assertEqual(len(items), 2)
            self.assertEqual({i['title'] for i in items}, {'Give tea'})
            self.assertGreater(items[0]['done_at'], items[1]['done_at'])  # newest first
        self.assertEqual(len(self.sponsor_api.get('/api/tasks/history/?days=1').data['items']), 1)

    def test_history_survives_the_task_being_deleted(self):
        self.tick(self.tid)
        self.caretaker_api.delete(f'/api/tasks/{self.tid}/')
        [item] = self.sponsor_api.get('/api/tasks/history/').data['items']
        self.assertEqual((item['title'], item['task_id']), ('Give tea', None))
        self.assertEqual(self.sponsor_api.get(f"/api/tasks/completions/{item['id']}/photo/").status_code, 200)

    def test_history_shows_who_assigned_the_task(self):
        tid = self.sponsor_api.post(
            '/api/tasks/', {'title': 'Short walk', 'caretaker_email': self.caretaker.email}, format='json'
        ).data['id']
        self.tick(tid)
        [item] = self.sponsor_api.get('/api/tasks/history/').data['items']
        self.assertEqual((item['assigned_by'], item['caretaker']), ('Pat Parent', 'Cara Care'))
