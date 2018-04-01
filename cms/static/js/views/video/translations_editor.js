define(
    [
        'jquery', 'underscore', 'edx-ui-toolkit/js/utils/html-utils', 'js/views/video/transcripts/utils',
        'js/views/abstract_editor', 'js/models/uploads', 'js/views/uploads',
        'text!templates/video-transcript-upload-status.underscore'

    ],
function($, _, HtmlUtils, TranscriptUtils, AbstractEditor, FileUpload, UploadDialog, VideoTranscriptUploadStatusTemplate) {
    'use strict';

    var VideoUploadDialog = UploadDialog.extend({
        error: function() {
            this.model.set({
                uploading: false,
                uploadedBytes: 0,
                title: gettext('Sorry, there was an error parsing the subtitles that you uploaded. Please check the format and try again.')
            });
        }
    });

    var Translations = AbstractEditor.extend({
        events: {
            'click .setting-clear': 'clear',
            'click .create-setting': 'addEntry',
            'click .remove-setting': 'removeEntry',
            'click .upload-setting': 'upload',
            'change select': 'onChangeHandler'
        },

        templateName: 'metadata-translations-entry',
        templateItemName: 'metadata-translations-item',

        initialize: function() {
            var templateName = _.result(this, 'templateItemName'),
                tpl = document.getElementById(templateName).text;

            if (!tpl) {
                console.error("Couldn't load template for item: " + templateName);
            }

            this.templateItem = _.template(tpl);
            AbstractEditor.prototype.initialize.apply(this, arguments);


            var languageMap = {};
            _.each(this.model.getDisplayValue(), function(value, lang) {
                languageMap[lang] = lang;
            });
            TranscriptUtils.Storage.set('languageMap', languageMap);
        },

        getDropdown: (function() {
            var dropdown,
                disableOptions = function(element, values) {
                    var dropdown = $(element).clone();

                    _.each(values, function(value, key) {
                        // Note: IE may raise an exception if key is an empty string,
                        // while other browsers return null as excepted. So coerce it
                        // into null for browser consistency.
                        if (key === '') {
                            key = null;
                        }

                        var option = dropdown[0].options.namedItem(key);

                        if (option) {
                            option.disabled = true;
                        }
                    });

                    return dropdown;
                };

            return function(values) {
                if (dropdown) {
                    return disableOptions(dropdown, values);
                }

                dropdown = document.createElement('select');
                dropdown.options.add(new Option());
                _.each(this.model.get('languages'), function(lang, index) {
                    var option = new Option();

                    option.setAttribute('name', lang.code);
                    option.value = lang.code;
                    option.text = lang.label;
                    dropdown.options.add(option);
                });

                return disableOptions(dropdown, values);
            };
        }()),

        getValueFromEditor: function() {
            var dict = {},
                items = this.$el.find('ol').find('.list-settings-item');

            _.each(items, function(element, index) {
                var key = $(element).find('select option:selected').val(),
                    value = $(element).find('.input').val();

                // Keys should be unique, so if our keys are duplicated and
                // second key is empty or key and value are empty just do
                // nothing. Otherwise, it'll be overwritten by the new value.
                if (value === '') {
                    if (key === '' || key in dict) {
                        return false;
                    }
                }

                dict[key] = value;
            });

            return dict;
        },

        // @TODO: Use backbone render patterns.
        setValueInEditor: function(values) {
            var self = this,
                frag = document.createDocumentFragment(),
                dropdown = self.getDropdown(values),
                languageMap = TranscriptUtils.Storage.get('languageMap');

            _.each(values, function(value, newLang) {
                var html = $(self.templateItem({
                    newLang: newLang,
                    originalLang: _.findKey(languageMap, function(lang){ return lang === newLang}) || '',
                    value: value,
                    url: self.model.get('urlRoot') + '/' + newLang
                })).prepend(dropdown.clone().val(newLang))[0];

                frag.appendChild(html);
            });

            this.$el.find('ol').html([frag]);
        },

        addEntry: function(event) {
            event.preventDefault();
            // We don't call updateModel here since it's bound to the
            // change event
            this.setValueInEditor(this.getAllLanguageDropdownElementsData(true));
            this.$el.find('.create-setting').addClass('is-disabled').attr('aria-disabled', true);
        },

        removeEntry: function(event) {
            event.preventDefault();

            //s('li.list-settings-item')
            var entry = $(event.currentTarget).parent.data('lang');
            this.setValueInEditor(_.omit(this.model.get('value'), entry));
            this.updateModel();
            this.$el.find('.create-setting').removeClass('is-disabled').attr('aria-disabled', false);
        },

        upload: function(event) {
            event.preventDefault();

            var self = this,
                $target = $(event.currentTarget),
                $languageDropdownEl = $target.closest('select'),
                newLanguage = $languageDropdownEl.val(),
                uploadURL = this.model.get('urlRoot'),
                originalLanguage = $target.parents('li.list-settings-item').data('original-lang'),
                edxVideoIdField = TranscriptUtils.getField(self.model.collection, 'edx_video_id').,
                fileUploadModel,
                uploadData,
                videoUploadDialog;

            // That's the case where user is
            // uploading a new transcript.
            if (!originalLanguage) {
                originalLanguage = newLanguage
            }

            // Transcript data payload
            uploadData = {
                edx_video_id: edxVideoIdField.getValue(),
                language_code: originalLanguage,
                new_language_code: newLanguage
            };

            fileUploadModel = new FileUpload({
                title: gettext('Upload translation'),
                fileFormats: ['srt']
            });

            videoUploadDialog = new VideoUploadDialog({
                model: fileUploadModel,
                url: uploadURL,
                parentElement: $target.closest('.xblock-editor'),
                uploadData: uploadData,
                onSuccess: function(response) {
                    if (!response.filename) { return; }

                    var dict = $.extend(true, {}, self.model.get('value'));

                    dict[lang] = response.filename;
                    self.model.setValue(dict);
                }
            });

            videoUploadDialog.show()

        //     // this.$el.find('.metadata-video-translations .upload-transcript-input').click()
        //     // this.renderMessage($target.closest('li'), 'uploading', '')
        //
        //     var $dropdown = $target.closest('select'),
        //         newLanguage = $dropdown.val();
        //
        //     if (!lang) {
        //         lang = newLanguage
        //     }
        //
        //     $transcriptUploadEl.fileupload({
        //         url: self.model.get('urlRoot'),
        //         add: this.transcriptSelected,
        //         done: this.transcriptUploadSucceeded,
        //         fail: this.transcriptUploadFailed,
        //         formData: {
        //             edx_video_id: edxVideoIdField.getValue(),
        //             language_code: lang,
        //             new_language_code: newLanguage
        //         }
        //     });
        //
        //
        //     debugger;
        //
        //
        //     this.clearMessage()
        },

        enableAdd: function() {
            this.$el.find('.create-setting').removeClass('is-disabled').attr('aria-disabled', false);
        },

        clear: function() {
            AbstractEditor.prototype.clear.apply(this, arguments);
            if (_.isNull(this.model.getValue())) {
                this.$el.find('.create-setting').removeClass('is-disabled').attr('aria-disabled', false);
            }
        },

        onChangeHandler: function(event) {
            var $target = $(event.currentTarget),
                originalLang = $target.parents('li.list-settings-item').data('original-lang'),
                newLang = $target.closest('select').val(),
                languageMap = TranscriptUtils.Storage.get('languageMap');

            // To protect against any new/unsaved language code in the map.
            if (originalLang in languageMap) {
                languageMap[originalLang] = newLang;
                TranscriptUtils.Storage.set('languageMap', languageMap);
            }

            this.showClearButton();
            this.enableAdd();
            this.setValueInEditor(this.getAllLanguageDropdownElementsData());
        },

        getAllLanguageDropdownElementsData: function(isNew) {
            var self = this,
                data = {},
                languageDropdownElements = this.$el.find('select');

            _.each(languageDropdownElements, function(languageDropdown, index){
                var language = $(languageDropdown).val(),
                    transcripts = self.model.getDisplayValue();
                data[language] = transcripts[language] || "";
            });

            if (isNew) {
                data[""] = "";
            }
            return data;
        }

    });

    return Translations;
});
