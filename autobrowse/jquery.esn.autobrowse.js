/**
 * Written by Micael Sjölund, ESN (http://www.esn.me)
 *
 * Creates a growing container that automatically fills its content via ajax requests, when the user scrolls to the
 * bottom of the container.
 *
 * Requires jStorage (http://www.jstorage.info/), if the useStorage option is set to true. WARNING: Experimental. It
 * doesn't work with original jStorage. 
 *
 * @param url Url to controller action where more data can be fetched (url/offset/count/ will be used to fetch more data)
 * @param template Template to be called with action json response
 * @param options Options that can be submitted to the plugin:
 * * offset        Offset for first ajax call to url
 * * count         How many items to fetch
 * * totalCount    Total number of items on server
 * * loader        Element, jQuery object or markup to represent loader
 * * itemsReturned Callback that is run on ajax json response to determine how many items was returned
 * * onComplete    Callback that is run when the element has been updated with new content. This is run before the
 *                 response is stored (if using useStorage), so it is possible to manipulate the response here before
 *                 it is stored.
 * * useStorage    If true, the plugin will use browser storage to keep the state between page reloads. If the user
 *                 clicks away from the page and then goes back, all items fetched will be rendered again.
 */

jQuery.fn.autogrow = function (url, template, options)
{
    var defaults = {
        offset: 0,
        count: 20,
        totalCount: 0,
        loader: '<div class="loader"></div>',
        itemsReturned: null,
        onComplete: function (response) {},
        useStorage: false
    };
    
    options = jQuery.extend(defaults, options);

    var getDataLength = function (data)
    {
        var length = 0
        for (var i = 0; i < data.length; i++)
            length += options.itemsReturned(data[i]);
        return length;
    };


    return this.each( function ()
    {
        var localData, obj = jQuery(this);
        var currentOffset = options.offset;
        var loading = false;
        
        var scrollTopUpdateTimer = null;

        var scrollCallback = function ()
        {
            var scrollTop = jQuery(window).scrollTop();
            var objBottom = obj.height() + obj.offset().top;
            var winBtmPos = scrollTop + jQuery(window).height();
            if (scrollTopUpdateTimer)
                clearTimeout(scrollTopUpdateTimer);
            scrollTopUpdateTimer = setTimeout(function () { $.jStorage.set("autogrowScrollTop", scrollTop); }, 200);
            if (objBottom < winBtmPos && !loading && currentOffset <= options.totalCount)
            {
                var loader = jQuery(options.loader);
                loader.appendTo(obj);
                loading = true;
                jQuery.post(url + "/" + currentOffset + "/" + options.count, function (response) {
                    // Check if this was the last items to fetch from the server, if so, stop listening
                    if (options.itemsReturned(response) + currentOffset >= options.totalCount || options.itemsReturned(response) == 0)
                    {
                        jQuery(window).unbind("scroll", scrollCallback);
                    }

                    if (options.itemsReturned(response) > 0)
                    {
                        // Create the markup and append it to the container
                        try { var markup = template.create(response); }
                        catch (e) { } // ignore for now
                        jQuery(markup).appendTo(obj);

                        // Call user onComplete callback
                        options.onComplete.call(obj, response);

                        // Store in local cache if option is set, and everything fetched fitted into the storage
                        if (options.useStorage && getDataLength(localData) + options.offset == currentOffset)
                        {
                            localData.push(response);
                            if (!jQuery.jStorage.set("autogrowStorage", localData))
                                // Storage failed, remove last pushed response
                                localData.pop();
                        }

                        // Update offsets
                        currentOffset += options.itemsReturned(response);
                        if (options.useStorage)
                        {
                            jQuery.jStorage.set("autogrowOffset", currentOffset);
                        }
                    }

                    loader.remove();
                    loading = false;

                }, "json");
            }
        };

        var startPlugin = function()
        {
            var autogrowScrollTop = jQuery.jStorage.get("autogrowScrollTop");
            if (autogrowScrollTop)
                jQuery(window).scrollTop(autogrowScrollTop);
            jQuery(window).scroll(scrollCallback);
        };


        if (options.useStorage)
        {
            if (jQuery.jStorage.get("autogrowStorageKey") != url)
            {
                jQuery.jStorage.flush();
            }

            localData= jQuery.jStorage.get("autogrowStorage");
            if (localData)
            {
                // for each stored ajax response
                for (var i = 0; i < localData.length; i++)
                {
                    var markup = template.create(localData[i]);
                    jQuery(markup).appendTo(obj);
                    currentOffset += options.itemsReturned(localData[i]);
                    options.onComplete.call(obj, localData[i]);
                }
                var offsetDifference = jQuery.jStorage.get("autogrowOffset") - currentOffset;
                if (offsetDifference > 0)
                {
                    // Storage didn't contain enough items, need to fetch them via ajax
                    var loader = jQuery(options.loader);
                    loader.appendTo(obj);
                    loading = true;
                    jQuery.post(url + "/" + currentOffset + "/" + offsetDifference, function (response) {
                        // Create the markup and append it to the container
                        try { var markup = template.create(response); }
                        catch (e) { } // ignore for now
                        jQuery(markup).appendTo(obj);
                        // Call user onComplete callback
                        options.onComplete.call(obj, response);
                        currentOffset += options.itemsReturned(response);
                        loader.remove();
                        loading = false;
                        startPlugin();
                    }, "json");
                }
                else
                {
                    startPlugin();
                }
            }
            else
            {
                localData = [];
                jQuery.jStorage.set("autogrowOffset", currentOffset);
                jQuery.jStorage.set("autogrowStorageKey", url);
                jQuery.jStorage.set("autogrowStorage", localData);
                jQuery.jStorage.set("autogrowScrollTop", 0);
                startPlugin();
            }
        }

        else
        {
            startPlugin();
        }
    });
};

