// flair-metal-hash: d2941b40
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uSmooth;
    float uGlow;
    float uWarmth;
    float uSkinOnly;
    uint uSweep;
    float uSplit;
    char _m19_pad[8];
    packed_float3 uLine;
    float uLineWidth;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_beauty_retouch_reveal_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _64)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_64.uBackdrop) * _64.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_64.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _64)
{
    float4 _208;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _208 = overBackdrop(param, _64);
    }
    else
    {
        float2 param_1 = fract(uv);
        _208 = float4(testCard(param_1), 1.0);
    }
    return _208;
}

static inline __attribute__((always_inline))
float skinLike(thread const float3& c)
{
    float y = dot(c, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625));
    float cb = ((0.5 - (0.16869999468326568603515625 * c.x)) - (0.3312999904155731201171875 * c.y)) + (0.5 * c.z);
    float cr = ((0.5 + (0.5 * c.x)) - (0.4187000095844268798828125 * c.y)) - (0.081299997866153717041015625 * c.z);
    return (((smoothstep(0.5299999713897705078125, 0.569999992847442626953125, cr) * smoothstep(0.7200000286102294921875, 0.680000007152557373046875, cr)) * smoothstep(0.2800000011920928955078125, 0.319999992847442626953125, cb)) * smoothstep(0.519999980926513671875, 0.4799999892711639404296875, cb)) * smoothstep(0.0599999986588954925537109375, 0.1599999964237213134765625, y);
}

static inline __attribute__((always_inline))
float3 evenSkin(thread const float2& fragCoord, thread const float3& here, thread const float& radius, thread const float& edges, constant FlairUniforms& _64, texture2d<float> uImage, sampler uImageSmplr)
{
    float3 sum = here;
    float wsum = 1.0;
    for (int i = 0; i < 12; i++)
    {
        float r = radius * ((i < 6) ? 0.5 : 1.0);
        float a = (float(i) * 1.0471999645233154296875) + ((i < 6) ? 0.0 : 0.52359998226165771484375);
        float2 param = (fragCoord + (float2(cos(a), sin(a)) * r)) / float2(_64.iResolution[0], _64.iResolution[1]);
        float3 c = pictureRGBA(uImage, uImageSmplr, param, _64).xyz;
        float3 d = c - here;
        float w = exp((-dot(d, d)) / ((2.0 * edges) * edges));
        sum += (c * w);
        wsum += w;
    }
    return sum / float3(wsum);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _64, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param = fragCoord / float2(_64.iResolution[0], _64.iResolution[1]);
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _64);
    float _381;
    if (_64.uSweep != 0u)
    {
        _381 = 0.5 + (0.3499999940395355224609375 * sin(_64.iTime * 1.0471999645233154296875));
    }
    else
    {
        _381 = _64.uSplit;
    }
    float split = _381 * _64.iResolution[0u];
    float4 col = pic;
    if (fragCoord.x > (split - 1.0))
    {
        float3 param_1 = pic.xyz;
        float skin = mix(1.0, skinLike(param_1), _64.uSkinOnly);
        float2 param_2 = fragCoord;
        float3 param_3 = pic.xyz;
        float param_4 = 0.01200000010430812835693359375 * _64.iResolution[1u];
        float param_5 = 0.100000001490116119384765625;
        float3 after = mix(pic.xyz, evenSkin(param_2, param_3, param_4, param_5, _64, uImage, uImageSmplr), float3(_64.uSmooth * skin));
        after += ((((float3(1.0) - after) * _64.uGlow) * 0.3499999940395355224609375) * skin);
        after *= mix(float3(1.0), float3(1.0499999523162841796875, 1.0, 0.930000007152557373046875), float3(_64.uWarmth));
        float3 _477 = mix(pic.xyz, fast::clamp(after, float3(0.0), float3(1.0)), float3(smoothstep(-0.75, 0.75, fragCoord.x - split)));
        col.x = _477.x;
        col.y = _477.y;
        col.z = _477.z;
    }
    float lw = (_64.uLineWidth * 0.001000000047497451305389404296875) * _64.iResolution[1u];
    float dx = abs(fragCoord.x - split);
    float line = fast::clamp(((0.5 * lw) + 0.5) - dx, 0.0, 1.0);
    float R = 6.0 * lw;
    float grip = fast::clamp((R - length(fragCoord - float2(split, 0.5 * _64.iResolution[1u]))) + 0.5, 0.0, 1.0) * step(0.5, lw);
    float4 _526 = col;
    float3 _535 = mix(_526.xyz, float3(_64.uLine), float3(fast::max(line, grip)));
    col.x = _535.x;
    col.y = _535.y;
    col.z = _535.z;
    col.w = fast::max(col.w, fast::max(line, grip));
    fragColor = col;
}

fragment flair_beauty_retouch_reveal_frag_out flair_beauty_retouch_reveal_frag(constant FlairUniforms& _64 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_beauty_retouch_reveal_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _562;
    if (_64.flair_flipY > 0.5)
    {
        _562 = _64.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _562 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _562);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _64, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

