//source: https://github.com/haruncpi/simple-context-menu
(function ($) {
    "use strict";
    $.fn.simpleContextMenu = function (customConfig) {

        let config = $.extend({
            class: null,
            shouldShow: null,
            heading: null,
            onShow: null,
            onHide: null,
            options: [],
        }, customConfig);

        let el = $(this);
        let container = $('div.scm-container');

        if (container.length === 0) {
            $('body').append('<div class="scm-container"></div>')

            if (config.class && typeof config.class === 'string') {
                $('div.scm-container').addClass(config.class)
            }
        }

        if ($('style.scm-style').length === 0) {
            let style = '.scm-container{box-sizing:border-box;background:#555;min-width:180px;max-width:180px;position:absolute;display:none;padding:6px 0;border-radius:6px}.scm-container .scm-item{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;padding:7px 12px;color:#fff;display:flex;font-size:13px;cursor:pointer;transition:.3s}.scm-container .scm-item>div:first-child{margin-right:10px}.scm-container .scm-item>div:nth-child(2){white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.scm-container .scm-item:hover{background:#4169e1;transition:.3s}.scm-container .scm-item.disabled{opacity:0.4;cursor:not-allowed}.scm-container .scm-item.disabled:hover{background:#555}'
            $('head').append(`<style class="scm-style">${style}</style>`)
        }

        $(document).click(function (e) {
            let container = $('div.scm-container');
            if (container.is(":visible")) {
                container.fadeOut('fast', function () {
                    if (typeof config.onHide === 'function') {
                        config.onHide()
                    }
                })
            }
        })

        el.contextmenu(function (e) {

            console.log('contextmenu', e);
            //if shouldShow is a function and returns false, then return
            if (typeof config.shouldShow === 'function' && !config.shouldShow()) {
                return
            }

            e.preventDefault()

            //get heading
            let heading = ''
            if (typeof config.heading === 'function') {
                heading = config.heading()
            }


            let container = $('div.scm-container');

            let html = ''

            if (heading) {
                html += `<div class="scm-item" style="font-size: 14px; font-weight: bold;">${heading}</div>`
            }

            config.options.forEach(function (item, index) {
                let isEnabled = true;
                if (typeof item.isEnabled === 'function') {
                    isEnabled = !!item.isEnabled();
                } else if (typeof item.enabled === 'boolean') {
                    isEnabled = item.enabled;
                }
                let disabledClass = isEnabled ? '' : ' disabled';
                let itemHtml = `<div class="scm-item${disabledClass}" data-index="${index}" data-disabled="${!isEnabled}">`;
                if (item.icon) {
                    itemHtml += `<div>${item.icon}</div>`
                }
                itemHtml += `<div>${item.label}</div>`
                itemHtml += '</div>'
                html += itemHtml;
            })

            container.html(html)

            let containerHeight = container.outerHeight()
            let containerWidth = container.outerWidth()

            let docHeight = $(document).outerHeight()
            let docWidth = $(document).outerWidth()

            let top = e.pageY;
            let left = e.pageX;

            if (e.pageX + containerWidth > docWidth) {
                left = docWidth - containerWidth
            }

            if (e.pageY + containerHeight > docHeight) {
                top = docHeight - containerHeight
            }

            container
                .css({
                    top: top,
                    left: left,
                    zIndex: 100
                })
                .slideDown('fast', function () {
                    if (typeof config.onShow === 'function') {
                        config.onShow()
                    }
                })

            container.find('div.scm-item').click(function () {
                let index = $(this).data('index')
                let target = config.options[index]
                let isDisabled = $(this).data('disabled') === true || $(this).data('disabled') === "true";
                if (isDisabled) {
                    return;
                }
                if ("action" in target && typeof target.action === 'function') {
                    target.action()
                }
            })

        })

    }

})(jQuery)