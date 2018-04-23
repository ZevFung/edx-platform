"""
Simulate course publish signals without actually modifying course content.

Many apps in the LMS maintain their own optimized data structures that they
update whenever a course publish is detected. To do this, they listen for the
SignalHandler.course_published signal. Sometimes we want to rebuild the data on
these apps regardless of an actual change in course content, either to recover
from a bug or to bootstrap a new app we're rolling out for the first time. To
date, each app has implemented its own management command for this kind of
bootstrapping work (e.g. generate_course_overviews, generate_course_blocks).

This management command will manually emit the SignalHandler.course_published
signal for some subset of courses and signal listeners, and then rely on
existing listener behavior to trigger the necessary data updates.


$ ./manage.py lms simulate_publish --show_listeners --settings=devstack_docker


simulate_publish --listeners openedx.core.djangoapps.content.course_overviews.signals._listen_for_course_publish


Simulate:
* lms
*

"""
from __future__ import print_function
import logging
import time

from django.core.management.base import BaseCommand
from opaque_keys import InvalidKeyError
from opaque_keys.edx.keys import CourseKey

from xmodule.modulestore.django import modulestore, SignalHandler

log = logging.getLogger('simulate_publish')


class Command(BaseCommand):
    """
    """
    args = u'<course_id course_id ...>'
    help = "This is my simple help message."

    # --delay 5 --dry-run

    def add_arguments(self, parser):
        parser.add_argument(
            '--show-receivers',
            dest='show_receivers',
            action='store_true',
            help=(u'Display the list of possible receiver functions and exit.')
        ),
        parser.add_argument(
            '--dry-run',
            dest='dry_run',
            action='store_true',
            help=(u"Just show a preview of what would happen.")
        ),
        parser.add_argument(
            '--receivers',
            dest='receivers',
            action='store',
            nargs='+',
            help=(
                u'Send course_published to specific receivers. If this flag is '
                u'not present, it will be sent to all receivers.'
            )
        )
        parser.add_argument(
            '--courses',
            dest='courses',
            action='store',
            nargs='+',
            help=(
                u'Send course_published for specific courses. If this flag is '
                u'not present, it will be sent to all courses.'
            )
        )
        parser.add_argument(
            '--delay',
            dest='delay',
            action='store',
            type=int,
            default=0,
            help=(
                u"Number of seconds to sleep between emitting course_published "
                u"events. Ideally shouldn't"
            )
        )

    def handle(self, *args, **options):
        all_receiver_names = get_receiver_names()
        if options['show_receivers']:
            for receiver_name in sorted(get_receiver_names()):
                print("  {}".format(receiver_name))
            return

        # Send to specific receivers if specified, but fall back to all receivers.
        if options['receivers']:
            receiver_names = options['receivers']
            unknown_receiver_names = set(receiver_names) - all_receiver_names
            if unknown_receiver_names:
                log.fatal(
                    "The following receivers were specified but not recognized: %s",
                    ", ".join(sorted(unknown_receiver_names))
                )
                return
            log.info("%d receivers specified: %s", len(receiver_names), ", ".join(receiver_names))
            log.info("Disconnecting other signal receivers...")
            receiver_names_set = set(receiver_names)
            for receiver_fn in get_receiver_fns():
                fn_name = name_from_fn(receiver_fn)
                if fn_name not in receiver_names_set:
                    log.info("Disconnecting %s", fn_name)
                    SignalHandler.course_published.disconnect(receiver_fn)

        # Use specific courses if specified, but fall back to all courses.
        if options['courses']:
            courses = options['courses']
            log.info("%d courses specified: %s", len(courses), ", ".join(courses))
            course_keys = []
            for course_id in courses:
                try:
                    course_keys.append(CourseKey.from_string(course_id))
                except InvalidKeyError as err:
                    log.fatal("%s is not a parseable CourseKey", course_id)
                    return
        else:
            log.info("No courses specified, reading all courses from modulestore...")
            course_keys = [course.id for course in modulestore().get_course_summaries()]
            log.info("%d courses read from modulestore.", len(course_keys))

        # Now that we have our signal receivers and courses set up properly, do
        # the actual work of emitting signals.
        for course_key in course_keys:
            log.info("Emitting course_published signal for course %s", course_key)
            if options['delay']:
                time.sleep(options['delay'])
            SignalHandler.course_published.send_robust(sender=self, course_key=course_key)

def get_receiver_names():
    return set(
        name_from_fn(fn_ref())
        for _, fn_ref in SignalHandler.course_published.receivers
    )

def get_receiver_fns():
    return [
        fn_ref()  # fn_ref is a weakref to a function, fn_ref() gives us the function
        for _, fn_ref in SignalHandler.course_published.receivers
    ]

def name_from_fn(fn):
    return u"{}.{}".format(fn.__module__, fn.__name__)