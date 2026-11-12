// flair-metal-hash: 26016fcb
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

// Implementation of the GLSL mod() function, which is slightly different than Metal fmod()
template<typename Tx, typename Ty>
inline Tx mod(Tx x, Ty y)
{
    return x - y * floor(x / y);
}

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
    float3 uTint;
    float3 uArrow;
    packed_float3 uInk;
    float uPlay;
    float uHold;
    float uSize;
    char _m19_pad[8];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_to_be_continued_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _104)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_104.uBackdrop) * _104.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_104.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _104)
{
    float4 _246;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _246 = overBackdrop(param, _104);
    }
    else
    {
        float2 param_1 = fract(uv);
        _246 = float4(testCard(param_1), 1.0);
    }
    return _246;
}

static inline __attribute__((always_inline))
float hash12(thread const float2& p)
{
    float3 p3 = fract(p.xyx * 0.103100001811981201171875);
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.x + p3.y) * p3.z);
}

static inline __attribute__((always_inline))
float4 inkBox(texture2d<float> uText, sampler uTextSmplr)
{
    float x0 = 1.0;
    float x1 = 0.0;
    for (int i = 0; i < 32; i++)
    {
        float u = (float(i) + 0.5) / 32.0;
        if (uText.sample(uTextSmplr, float2(u, 0.5), level(4.0)).w > 0.039999999105930328369140625)
        {
            x0 = u;
            break;
        }
    }
    for (int i_1 = 31; i_1 >= 0; i_1--)
    {
        float u_1 = (float(i_1) + 0.5) / 32.0;
        if (uText.sample(uTextSmplr, float2(u_1, 0.5), level(4.0)).w > 0.039999999105930328369140625)
        {
            x1 = u_1;
            break;
        }
    }
    if (x1 < x0)
    {
        return float4(0.0);
    }
    float y0 = 1.0;
    float y1 = 0.0;
    for (int j = 31; j >= 0; j--)
    {
        float v = (float(j) + 0.5) / 32.0;
        float a = 0.0;
        for (int k = 0; k < 3; k++)
        {
            a = fast::max(a, uText.sample(uTextSmplr, float2(mix(x0, x1, (float(k) + 0.5) / 3.0), v), level(3.0)).w);
        }
        if (a > 0.20000000298023223876953125)
        {
            y1 = v;
            break;
        }
    }
    for (int j_1 = 0; j_1 < 32; j_1++)
    {
        float v_1 = (float(j_1) + 0.5) / 32.0;
        float a_1 = 0.0;
        for (int k_1 = 0; k_1 < 3; k_1++)
        {
            a_1 = fast::max(a_1, uText.sample(uTextSmplr, float2(mix(x0, x1, (float(k_1) + 0.5) / 3.0), v_1), level(3.0)).w);
        }
        if (a_1 > 0.20000000298023223876953125)
        {
            y0 = v_1;
            break;
        }
    }
    float4 _456;
    if (y1 > y0)
    {
        _456 = float4(x0, x1, y0, y1);
    }
    else
    {
        _456 = float4(0.0);
    }
    return _456;
}

static inline __attribute__((always_inline))
float sdBox(thread const float2& p, thread const float2& b)
{
    float2 d = abs(p) - b;
    return length(fast::max(d, float2(0.0))) + fast::min(fast::max(d.x, d.y), 0.0);
}

static inline __attribute__((always_inline))
float arrowDist(thread const float2& p, thread const float& h, thread const float& len)
{
    float hw = h * 0.85000002384185791015625;
    float hh = h * 0.800000011920928955078125;
    float2 q = float2(p.x, abs(p.y));
    float head = fast::max(dot(q, fast::normalize(float2(-hh, hw))), p.x - hw);
    float2 param = p - float2(((hw * 0.699999988079071044921875) + len) * 0.5, 0.0);
    float2 param_1 = float2((len - (hw * 0.699999988079071044921875)) * 0.5, h * 0.5);
    float body = sdBox(param, param_1);
    return fast::min(head, body);
}

static inline __attribute__((always_inline))
float words(thread const float2& tuv, texture2d<float> uText, sampler uTextSmplr)
{
    float a = uText.sample(uTextSmplr, fast::clamp(tuv, float2(0.0), float2(1.0))).w;
    bool _280 = all(tuv >= float2(0.0));
    bool _287;
    if (_280)
    {
        _287 = all(tuv <= float2(1.0));
    }
    else
    {
        _287 = _280;
    }
    return _287 ? a : 0.0;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _104, texture2d<float> uText, sampler uTextSmplr, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_104.iResolution[0], _104.iResolution[1]);
    float t = mod(_104.iTime, _104.uPlay + _104.uHold);
    float frozen = step(_104.uPlay, t);
    float since = t - _104.uPlay;
    float punch = frozen * (1.0 + (0.039999999105930328369140625 * (1.0 - exp((-since) * 10.0))));
    float2 param = float2(0.5) + ((uv - float2(0.5)) / float2(fast::max(punch, 1.0)));
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _104);
    float3 col = pic.xyz;
    float l = dot(col, float3(0.2125999927520751953125, 0.715200006961822509765625, 0.072200000286102294921875));
    float3 sepia = fast::clamp((_104.uTint * l) * 1.5, float3(0.0), float3(1.0));
    float aspect = _104.iResolution[0u] / _104.iResolution[1u];
    float r = length((uv - float2(0.5)) * float2(aspect, 1.0));
    sepia *= (1.0 - (0.449999988079071044921875 * smoothstep(0.300000011920928955078125, 1.0, r)));
    float2 param_1 = fragCoord + float2(floor(_104.iTime * 12.0));
    sepia += float3((hash12(param_1) - 0.5) * 0.039999999105930328369140625);
    col = mix(col, sepia, float3(frozen * smoothstep(0.0, 0.119999997317790985107421875, since)));
    float shown = frozen * step(0.25, since);
    float h = _104.uSize;
    float2 p = (uv * float2(aspect, 1.0)) - float2(0.0, 0.0599999986588954925537109375 + h);
    bool _676 = shown < 0.5;
    bool _687;
    if (!_676)
    {
        _687 = abs(p.y) > (h * 1.2000000476837158203125);
    }
    else
    {
        _687 = _676;
    }
    if (_687)
    {
        fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), pic.w);
        return;
    }
    float4 ink = inkBox(uText, uTextSmplr);
    float2 tsize = float2(int2(uText.get_width(), uText.get_height()));
    float inkH = fast::max(ink.w - ink.z, 0.001000000047497451305389404296875);
    float th = (h * 0.5) / inkH;
    float tw = (th * tsize.x) / fast::max(tsize.y, 1.0);
    float textX = h * 0.949999988079071044921875;
    float room = ((aspect - 0.100000001490116119384765625) - textX) - (h * 0.4000000059604644775390625);
    float inkW = (ink.y - ink.x) * tw;
    float _756;
    if (inkW > room)
    {
        _756 = room / inkW;
    }
    else
    {
        _756 = 1.0;
    }
    float fitScale = _756;
    th *= fitScale;
    tw *= fitScale;
    float _777;
    if (ink.y > ink.x)
    {
        _777 = (ink.y - ink.x) * tw;
    }
    else
    {
        _777 = h * 1.5;
    }
    float len = (textX + _777) + (h * 0.4000000059604644775390625);
    float slide = fast::clamp((since - 0.25) / 0.449999988079071044921875, 0.0, 1.0);
    slide = (1.0 + (2.2000000476837158203125 * powr(slide - 1.0, 3.0))) + (1.2000000476837158203125 * powr(slide - 1.0, 2.0));
    p.x -= (0.0500000007450580596923828125 - ((1.0 - slide) * (len + 0.100000001490116119384765625)));
    float2 param_2 = p;
    float param_3 = h;
    float param_4 = len;
    float d = arrowDist(param_2, param_3, param_4);
    float px = 1.0 / _104.iResolution[1u];
    float border = h * 0.07999999821186065673828125;
    float outer = smoothstep(px, -px, d);
    float inner = smoothstep(px, -px, d + border);
    float3 board = mix(float3(_104.uInk), _104.uArrow, float3(inner));
    float2 tuv = float2(ink.x + ((p.x - textX) / tw), ((ink.z + ink.w) * 0.5) + (p.y / th));
    float2 param_5 = tuv;
    board = mix(board, float3(_104.uInk), float3(words(param_5, uText, uTextSmplr) * inner));
    float2 param_6 = p - float2(h * 0.07999999821186065673828125, (-h) * 0.100000001490116119384765625);
    float param_7 = h;
    float param_8 = len;
    float shadow = smoothstep(h * 0.25, 0.0, arrowDist(param_6, param_7, param_8)) * 0.5;
    col *= (1.0 - (shadow * (1.0 - outer)));
    col = mix(col, board, float3(outer));
    fragColor = float4(fast::clamp(col, float3(0.0), float3(1.0)), fast::max(pic.w, fast::max(outer, shadow)));
}

fragment flair_to_be_continued_frag_out flair_to_be_continued_frag(constant FlairUniforms& _104 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], texture2d<float> uText [[texture(2)]], sampler uImageSmplr [[sampler(1)]], sampler uTextSmplr [[sampler(2)]], float4 gl_FragCoord [[position]])
{
    flair_to_be_continued_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _951;
    if (_104.flair_flipY > 0.5)
    {
        _951 = _104.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _951 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _951);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _104, uText, uTextSmplr, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

