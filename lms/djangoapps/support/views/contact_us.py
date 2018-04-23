"""
Signle support contact view
"""
from django.conf import settings
from django.views.generic import View
from courseware.courses import get_course_by_id
from courseware.model_data import FieldDataCache
from edxmako.shortcuts import render_to_response
from student.models import CourseEnrollment
from xblock.fields import Scope
from xblock.runtime import KeyValueStore

from openedx.core.djangoapps.site_configuration import helpers as configuration_helpers
from openedx.features.enterprise_support import api as enterprise_api


class ContactUsView(View):
    """
    View for viewing and submitting contact us form.
    """

    def get(self, request):
        context = {
            'platform_name': configuration_helpers.get_value('platform_name', settings.PLATFORM_NAME),
            'support_email': configuration_helpers.get_value('CONTACT_EMAIL', settings.CONTACT_EMAIL),
            'custom_fields': settings.ZENDESK_CUSTOM_FIELDS
        }

        # Tag all issues with LMS to distinguish channel which received the request
        tags = ['LMS']

        # Per edX support, we would like to be able to route feedback items by site via tagging
        current_site_name = configuration_helpers.get_value("SITE_NAME")
        if current_site_name:
            current_site_name = current_site_name.replace(".", "_")
            tags.append("site_name_{site}".format(site=current_site_name))

        if request.user.is_authenticated():
            context['user_enrollments'] = CourseEnrollment.enrollments_for_user_with_overviews_preload(request.user)
            enterprise_learner_data = enterprise_api.get_enterprise_learner_data(site=request.site, user=request.user)
            if enterprise_learner_data:
                tags.append('enterprise_learner')

        context['tags'] = tags
        last_accessed_course = self.get_last_accessed_course(request, context['user_enrollments'])
        context['course_id'] = last_accessed_course.get('course_id')

        return render_to_response("support/contact_us.html", context)

    def get_last_accessed_course(self, request, enrollments):
        """Get learner's last accessed course."""
        dates = []
        for enrollment in enrollments:
            course = get_course_by_id(enrollment.course_overview.id)
            field_data_cache = FieldDataCache.cache_for_descriptor_descendents(
                course.id, request.user, course, depth=2)
            key = KeyValueStore.Key(
                scope=Scope.user_state,
                user_id=request.user.id,
                block_scope_id=course.location,
                field_name='position'
            )
            last_modified = field_data_cache.last_modified(key)
            if last_modified:
                dates.append(
                    {'course_id': unicode(course.id), 'last_modified': last_modified}
                )

        return max(dates, key=lambda x: x['last_modified'])
